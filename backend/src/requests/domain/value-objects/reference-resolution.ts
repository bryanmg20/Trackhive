import type { MaterialReference } from './material-reference';
import type { SavedStatusChange } from './saved-status-change';
import type { StatusChange } from './status-change';

/**
 * The staff associated a catalog material with a pending reference
 * (HU-09.2). The reference becomes RESUELTA, the material joins the request
 * and `historyEntry` is its row in status_history: the status does not
 * change, it records who did it and which material it was.
 */
export interface ReferenceResolution {
  readonly requestId: string;
  readonly referenceId: string;
  readonly materialId: string;
  readonly resolvedBy: string;
  readonly resolvedAt: Date;
  readonly historyEntry: StatusChange;
}

/** The resolution as it was saved, with the name of who made it. */
export interface SavedReferenceResolution {
  readonly reference: MaterialReference;
  readonly resolvedAt: Date;
  readonly historyEntry: SavedStatusChange;
}
