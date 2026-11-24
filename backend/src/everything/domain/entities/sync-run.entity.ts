import { InvalidSyncRunStatusError } from '../errors/invalid-sync-run-status.error';
import { SyncRunExpiredError } from '../errors/sync-run-expired.error';
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
  startedAt: Date;
  // The start of the run or its last page
  lastActivityAt: Date;
  // null while the run is EN_CURSO
  finishedAt: Date | null;
  // Results Everything returned in the pages of the run
  filesCount: number;
  // Only when status = ERROR
  errorMessage: string | null;
}

/**
 * One run of the Everything sync (HU-137). The agent (HU-166) starts it,
 * sends its pages and closes it, and the run decides what it accepts:
 * - pages and the close only while it is EN_CURSO and has not expired;
 * - after timeoutMinutes without activity (the agent stopped or lost the
 *   connection) it has expired, and it ends with an error;
 * - it ends only once, OK or ERROR. Only an OK run, closed complete, lets
 *   the sync mark the copies it did not see as not found.
 */
export class SyncRun {
  public readonly id: string;
  public readonly status: SyncRunStatus;
  public readonly startedAt: Date;
  public readonly lastActivityAt: Date;
  public readonly finishedAt: Date | null;
  public readonly filesCount: number;
  public readonly errorMessage: string | null;

  constructor(props: SyncRunProps) {
    if (!isSyncRunStatus(props.status)) {
      throw new InvalidSyncRunStatusError();
    }
    this.id = props.id;
    this.status = props.status;
    this.startedAt = props.startedAt;
    this.lastActivityAt = props.lastActivityAt;
    this.finishedAt = props.finishedAt;
    this.filesCount = props.filesCount;
    this.errorMessage = props.errorMessage;
  }

  static start(id: string, now: Date = new Date()): SyncRun {
    return new SyncRun({
      id,
      status: 'EN_CURSO',
      startedAt: now,
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

  get isRunning(): boolean {
    return this.status === 'EN_CURSO';
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
    return now < this.startedAt ? this.startedAt : now;
  }
}
