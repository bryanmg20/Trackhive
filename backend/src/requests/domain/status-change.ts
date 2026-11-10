import type { RequestStatus } from './request-status';

/**
 * Immutable record of one status change of a request («CambioEstado» in
 * docs/modelo-datos.md §1.3): who made it, when, and an optional comment.
 * It becomes one row of status_history (D-08).
 */
export interface StatusChange {
  readonly requestId: string;
  readonly previousStatus: RequestStatus;
  readonly newStatus: RequestStatus;
  readonly changedBy: string;
  readonly changedAt: Date;
  readonly comment: string | null;
}
