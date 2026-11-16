import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';
import type { StatusChange } from '../../domain/value-objects/status-change';

/** A row of status_history just inserted, with the name of who made it. */
export interface StatusHistoryRow {
  changedAt: Date;
  comment: string | null;
  user: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  };
}

/** Translates a row of status_history into the saved change (D-08). */
export class PrismaStatusHistoryMapper {
  static toSavedStatusChange(
    change: StatusChange,
    row: StatusHistoryRow,
  ): SavedStatusChange {
    return {
      previousStatus: change.previousStatus,
      newStatus: change.newStatus,
      changedAt: row.changedAt,
      comment: row.comment,
      changedBy: row.user,
    };
  }
}
