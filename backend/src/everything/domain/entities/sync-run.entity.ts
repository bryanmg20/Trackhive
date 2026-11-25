import { InvalidSyncRunStatusError } from '../errors/invalid-sync-run-status.error';
import { SyncRunExpiredError } from '../errors/sync-run-expired.error';
import { SyncRunNotRequestedError } from '../errors/sync-run-not-requested.error';
import { SyncRunNotRunningError } from '../errors/sync-run-not-running.error';
import { isSyncRunStatus, SyncRunStatus } from '../enums/sync-run-status';

// sync_runs.error_message is varchar(1000)
export const MAX_SYNC_ERROR_LENGTH = 1000;
const MS_PER_MINUTE = 60_000;
const UNKNOWN_ERROR = 'La corrida terminó con un error sin detalle';

/** Cut by code points, never in the middle of a surrogate pair. */
const fit = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed === '') {
    return UNKNOWN_ERROR;
  }
  if (trimmed.length <= MAX_SYNC_ERROR_LENGTH) {
    return trimmed;
  }
  let cut = '';
  for (const char of trimmed) {
    if (cut.length + char.length > MAX_SYNC_ERROR_LENGTH - 1) {
      break;
    }
    cut += char;
  }
  return `${cut}…`;
};

export interface SyncRunProps {
  id: string;
  status: SyncRunStatus;
  // «Sincronizar ahora» (HU-138): when and who asked for the run. Both null
  // in a run the agent started on its own
  requestedAt: Date | null;
  requestedById: string | null;
  // null while the run is PEDIDA: the agent has not taken it yet
  startedAt: Date | null;
  // The start of the run or its last page; the request while PEDIDA
  lastActivityAt: Date;
  // null while the run is PEDIDA or EN_CURSO
  finishedAt: Date | null;
  // Results Everything returned in the pages of the run
  filesCount: number;
  // Only when status = ERROR
  errorMessage: string | null;
}

/** The same rules as the CHECKs of sync_runs: a stored run that breaks them is corrupt. */
const isConsistent = (props: SyncRunProps): boolean =>
  (props.status === 'PEDIDA') === (props.startedAt === null) &&
  (props.requestedAt === null) === (props.requestedById === null) &&
  (props.status !== 'PEDIDA' || props.requestedAt !== null);

/**
 * One run of the Everything sync (HU-137). The agent (HU-166) starts it,
 * sends its pages and closes it, and the run decides what it accepts:
 * - an administrator may ask for it with «Sincronizar ahora» (HU-138): it
 *   waits PEDIDA, without expiring, until the agent takes it;
 * - pages and the close only while it is EN_CURSO and has not expired;
 * - after timeoutMinutes without activity (the agent stopped or lost the
 *   connection) it has expired, and it ends with an error;
 * - it ends only once, OK or ERROR. Only an OK run, closed complete, lets
 *   the sync mark the copies it did not see as not found.
 */
export class SyncRun {
  public readonly id: string;
  public readonly status: SyncRunStatus;
  public readonly requestedAt: Date | null;
  public readonly requestedById: string | null;
  public readonly startedAt: Date | null;
  public readonly lastActivityAt: Date;
  public readonly finishedAt: Date | null;
  public readonly filesCount: number;
  public readonly errorMessage: string | null;

  constructor(props: SyncRunProps) {
    if (!isSyncRunStatus(props.status) || !isConsistent(props)) {
      throw new InvalidSyncRunStatusError();
    }
    this.id = props.id;
    this.status = props.status;
    this.requestedAt = props.requestedAt;
    this.requestedById = props.requestedById;
    this.startedAt = props.startedAt;
    this.lastActivityAt = props.lastActivityAt;
    this.finishedAt = props.finishedAt;
    this.filesCount = props.filesCount;
    this.errorMessage = props.errorMessage;
  }

  /** The agent starts a run on its own, without a request (its daily run). */
  static start(id: string, now: Date = new Date()): SyncRun {
    return new SyncRun({
      id,
      status: 'EN_CURSO',
      requestedAt: null,
      requestedById: null,
      startedAt: now,
      lastActivityAt: now,
      finishedAt: null,
      filesCount: 0,
      errorMessage: null,
    });
  }

  /**
   * «Sincronizar ahora» (HU-138): an administrator asks for a run. It waits
   * PEDIDA until the agent takes it, however long that takes (the PC of the
   * CLENA may be off): a run that has not started does not expire.
   */
  static request(
    id: string,
    requestedById: string,
    now: Date = new Date(),
  ): SyncRun {
    return new SyncRun({
      id,
      status: 'PEDIDA',
      requestedAt: now,
      requestedById,
      startedAt: null,
      lastActivityAt: now,
      finishedAt: null,
      filesCount: 0,
      errorMessage: null,
    });
  }

  /** Before this moment, no activity means a run has expired. */
  static inactiveBefore(timeoutMinutes: number, now: Date = new Date()): Date {
    return new Date(now.getTime() - timeoutMinutes * MS_PER_MINUTE);
  }

  /** Waiting for the agent to take it (HU-138). */
  get isRequested(): boolean {
    return this.status === 'PEDIDA';
  }

  get isRunning(): boolean {
    return this.status === 'EN_CURSO';
  }

  /**
   * The agent takes the run an administrator asked for (HU-138): from now on
   * it is EN_CURSO, like a run the agent starts on its own, and it keeps who
   * asked for it.
   */
  take(now: Date = new Date()): SyncRun {
    if (!this.isRequested) {
      throw new SyncRunNotRequestedError();
    }
    return new SyncRun({
      ...this,
      status: 'EN_CURSO',
      // Never before the request, even with the clocks of two instances apart
      startedAt: this.notBefore(this.lastActivityAt, now),
      lastActivityAt: this.notBefore(this.lastActivityAt, now),
    });
  }

  /** EN_CURSO and without pages for more than timeoutMinutes. */
  isExpired(timeoutMinutes: number, now: Date = new Date()): boolean {
    return (
      this.isRunning &&
      this.lastActivityAt < SyncRun.inactiveBefore(timeoutMinutes, now)
    );
  }

  /**
   * Throws unless the run still takes pages and its close: EN_CURSO and not
   * expired.
   */
  assertOpen(timeoutMinutes: number, now: Date = new Date()): void {
    if (!this.isRunning) {
      throw new SyncRunNotRunningError();
    }
    if (this.isExpired(timeoutMinutes, now)) {
      throw new SyncRunExpiredError(timeoutMinutes);
    }
  }

  /** A page arrived: the run is alive. */
  recordActivity(now: Date = new Date()): SyncRun {
    this.assertRunning();
    return new SyncRun({ ...this, lastActivityAt: now });
  }

  /** Ends with an error: nothing is marked as not found. */
  fail(reason: string, now: Date = new Date()): SyncRun {
    this.assertRunning();
    return new SyncRun({
      ...this,
      status: 'ERROR',
      finishedAt: this.finishedAtFor(now),
      errorMessage: fit(reason),
    });
  }

  /** Ends with an error because it spent timeoutMinutes without pages. */
  expire(timeoutMinutes: number, now: Date = new Date()): SyncRun {
    return this.fail(
      `La corrida venció: no recibió páginas del agente en más de ${timeoutMinutes} minutos ` +
        '(el agente se cerró o perdió la conexión)',
      now,
    );
  }

  /** Ends complete and without errors. */
  complete(now: Date = new Date()): SyncRun {
    this.assertRunning();
    return new SyncRun({
      ...this,
      status: 'OK',
      finishedAt: this.finishedAtFor(now),
      errorMessage: null,
    });
  }

  private assertRunning(): void {
    if (!this.isRunning) {
      throw new SyncRunNotRunningError();
    }
  }

  /**
   * Two instances of the backend may start and close the run with clocks a
   * little apart: the end is never before the start (CHECK of sync_runs).
   */
  private finishedAtFor(now: Date): Date {
    return this.startedAt === null ? now : this.notBefore(this.startedAt, now);
  }

  private notBefore(earliest: Date, now: Date): Date {
    return now < earliest ? earliest : now;
  }
}
