import { SyncRun } from '../entities/sync-run.entity';
import type { ReceivedSyncPage } from '../value-objects/received-sync-page';
import type { SyncedMaterial } from '../value-objects/synced-material';

/** What saving the materials of a page did (HU-137). */
export interface SavedMaterialsCount {
  created: number;
  updated: number;
}

/**
 * Persistence of the Everything sync (HU-137): the runs in sync_runs, their
 * pages until they close and the materials they bring. Every method that
 * writes more than one row does it in one transaction.
 */
export interface ISyncRunRepository {
  /**
   * Saves a new run, EN_CURSO or PEDIDA (HU-138). SyncRunAlreadyRunningError
   * if another run is EN_CURSO or PEDIDA: the partial unique index of
   * sync_runs decides, even with two instances of the backend.
   */
  create(run: SyncRun): Promise<void>;

  findById(id: string): Promise<SyncRun | null>;

  /** The run EN_CURSO, if there is one. */
  findRunning(): Promise<SyncRun | null>;

  /** The run PEDIDA that waits for the agent, if there is one (HU-138). */
  findRequested(): Promise<SyncRun | null>;

  /**
   * Saves that the agent took the run PEDIDA: it is EN_CURSO from now on
   * (HU-138). SyncRunAlreadyRunningError if it was no longer PEDIDA: another
   * execution of the agent took it first.
   */
  take(run: SyncRun): Promise<void>;

  /**
   * Saves the page (replacing one with the same number, so the agent may
   * retry it) and the activity of the run, in one transaction. Returns the
   * run with its files_count. SyncRunNotRunningError if the run ended.
   */
  savePage(run: SyncRun, page: ReceivedSyncPage): Promise<SyncRun>;

  /** The pages of the run, by number. */
  findPages(runId: string): Promise<ReceivedSyncPage[]>;

  /**
   * Creates or updates each material by its catalog code (never by its
   * path), all in one transaction: the materials of one page.
   */
  saveMaterials(materials: SyncedMaterial[]): Promise<SavedMaterialsCount>;

  /**
   * Saves a run that ended with an error and drops its pages, in one
   * transaction. With `inactiveBefore`, only if it still had no activity
   * since then (expiry). SyncRunNotRunningError if it no longer applies.
   */
  finish(run: SyncRun, inactiveBefore?: Date): Promise<void>;

  /**
   * Saves a run that ended OK, marks as «copia digital no encontrada» every
   * Everything material it did not see (last seen before `seenAt`) and drops
   * its pages, in one transaction. No material is ever deleted. Returns how
   * many it marked. SyncRunNotRunningError if the run already ended.
   */
  complete(run: SyncRun, seenAt: Date): Promise<number>;
}
