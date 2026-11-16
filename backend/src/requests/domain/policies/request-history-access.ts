import type { UserRole } from '../../../users/domain/enums/user-role';
import { RequestAccessForbiddenError } from '../errors/request-access-forbidden.error';

/** Who opens the history of a request (HU-17). */
export interface HistoryViewer {
  id: string;
  role: UserRole;
}

/** The staff and the admin read the whole history of any request. */
function isStaff(viewer: HistoryViewer): boolean {
  return viewer.role !== 'PUBLICO';
}

/**
 * The staff and the admin open the history of any request; a public user
 * only that of a request whose requester is their own account. A visitor's
 * request (no account) is never theirs.
 */
export function assertCanViewHistory(
  viewer: HistoryViewer,
  requesterUserId: string | null,
): void {
  if (!isStaff(viewer) && requesterUserId !== viewer.id) {
    throw new RequestAccessForbiddenError();
  }
}

/** A row the staff marked as internal is hidden from the requester. */
export function canSeeHistoryEntry(
  viewer: HistoryViewer,
  entry: { visibleToRequester: boolean },
): boolean {
  return isStaff(viewer) || entry.visibleToRequester;
}

/**
 * Whether the viewer sees the name of who made a change. The requester sees
 * their own name, but not the name of the staff member, which stays private:
 * to them the change was made by the CLENA.
 */
export function revealsResponsible(
  viewer: HistoryViewer,
  changedById: string,
): boolean {
  return isStaff(viewer) || changedById === viewer.id;
}
