import type { Prisma } from '@prisma/client';
import type { Request } from '../../domain/entities/request.entity';
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

  /**
   * The new status of the request and what the change derived from it
   * (attendedAt, closedAt, the rejection reason). Only the columns the
   * change sets are written.
   */
  static toRequestUpdate(
    change: StatusChange,
  ): Prisma.RequestModelUpdateManyMutationInput {
    return {
      status: change.newStatus,
      version: { increment: 1 },
      ...(change.attendedAt && { attendedAt: change.attendedAt }),
      ...(change.closedAt && { closedAt: change.closedAt }),
      // HU-16: the reason the requester reads in «Mis solicitudes»
      ...(change.rejectionReason && {
        rejectionReason: change.rejectionReason,
      }),
    };
  }

  /** The row of status_history of the change (D-08). */
  static toHistoryRow(
    change: StatusChange,
  ): Prisma.StatusHistoryModelUncheckedCreateInput {
    return {
      requestId: change.requestId,
      previousStatus: change.previousStatus,
      newStatus: change.newStatus,
      userId: change.changedBy,
      comment: change.comment,
      changedAt: change.changedAt,
    };
  }

  /**
   * The first row of a new request (HU-17): no previous status, RECIBIDA, and
   * who registered it. Created together with the request, so its date is the
   * same as registered_at (both default to the transaction time).
   */
  static toCreationRow(
    request: Request,
  ): Prisma.StatusHistoryModelUncheckedCreateWithoutRequestInput {
    const { registration } = request;
    if (!registration) {
      throw new Error(`Request ${request.id} has no registration data`);
    }
    return {
      previousStatus: null,
      newStatus: request.status,
      userId: registration.createdById,
    };
  }
}
