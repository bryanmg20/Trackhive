/** A folder of a page, as Everything reported it (HU-135). */
export interface SyncFolder {
  readonly fullPath: string;
  readonly modifiedAt: Date;
}

/**
 * A page of a run, kept until the run closes (HU-137). The leaf folders and
 * the repeated codes are only known with every page (HU-136), so the
 * materials are saved when the run closes complete, page by page.
 */
export interface ReceivedSyncPage {
  // 1, 2, 3…, numbered by the agent
  readonly number: number;
  // Results Everything returned in the page, folders and files (files_count)
  readonly resultsCount: number;
  // Only the folders: the sync turns the leaf folders into materials
  readonly folders: readonly SyncFolder[];
  readonly receivedAt: Date;
}
