import type { RequestStatus } from '../enums/request-status';

/**
 * The statuses in which the staff can still associate the catalog material
 * of a written reference (HU-09.2). The rule of Request.resolveReference and
 * the «por resolver» filter of the staff listing both read it, so they never
 * disagree.
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
