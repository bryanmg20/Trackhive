import type { MaterialReferenceDisplayStatus } from '../enums/material-reference-display-status';
import type { MaterialReferenceStatus } from '../enums/material-reference-status';
import type { RequestStatus } from '../enums/request-status';

/**
 * The statuses in which the staff can still associate the catalog material
 * of a written reference (HU-09.2). The rule of Request.resolveReference, the
 * «por resolver» filter of the staff listing and what the screens show all
 * read it, so they never disagree.
 */
export const REFERENCE_RESOLVABLE_STATUSES = [
  'RECIBIDA',
  'EN_BUSQUEDA',
] as const satisfies readonly RequestStatus[];

/** Whether a reference of a request in this status can still be resolved. */
export function canResolveReferences(status: RequestStatus): boolean {
  return (REFERENCE_RESOLVABLE_STATUSES as readonly RequestStatus[]).includes(
    status,
  );
}

/**
 * What the screens show of a reference: past EN_BUSQUEDA one without
 * material is no longer pending, it was delivered without it (HU-09.2).
 */
export function referenceDisplayStatus(
  status: MaterialReferenceStatus,
  requestStatus: RequestStatus,
): MaterialReferenceDisplayStatus {
  if (status === 'RESUELTA') {
    return 'RESUELTA';
  }
  return canResolveReferences(requestStatus) ? 'PENDIENTE' : 'SIN_MATERIAL';
}
