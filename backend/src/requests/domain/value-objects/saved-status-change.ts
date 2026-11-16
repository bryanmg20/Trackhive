import type { RequestStatus } from '../enums/request-status';

/** A row of status_history as it was saved, with the name of who made it. */
export interface SavedStatusChange {
  readonly previousStatus: RequestStatus;
  readonly newStatus: RequestStatus;
  readonly changedAt: Date;
  readonly comment: string | null;
  readonly changedBy: {
    readonly id: string;
    readonly firstName: string;
    readonly middleName: string | null;
    readonly lastName: string;
    readonly secondLastName: string | null;
  };
}
