import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import type { Request } from '../entities/request.entity';
import type { SavedAppointment } from '../value-objects/saved-appointment';
import type { SavedStatusChange } from '../value-objects/saved-status-change';
import type { StatusChange } from '../value-objects/status-change';

/**
 * Saves and loads the Request entity (R3). What is only read to show on a
 * screen lives in IRequestQueryService (D-D).
 */
export interface IRequestRepository {
  /** Inserts a new request (Request.create) with its materials (HU-09, HU-10). */
  save(request: Request): Promise<void>;

  /** The request as a domain entity, to apply its transition rules (HU-15). */
  findById(id: string): Promise<Request | null>;

  /**
   * Saves the new status and inserts its row in status_history in one
   * transaction (D-08). In the same transaction it queues `notification`,
   * the email to the requester, in the outbox (HU-23, D-10); null when the
   * requester has no email. Throws RequestStatusConflictError when the
   * request is no longer in `previousStatus` because someone else changed it
   * first, and then nothing is saved or queued.
   */
  saveStatusChange(
    change: StatusChange,
    notification: NotificationDraft | null,
  ): Promise<SavedStatusChange>;

  /**
   * Schedules an appointment (HU-18) in one transaction: saves the change to
   * AGENDADA with its row in status_history and its email, like
   * saveStatusChange, and creates the appointment for `date` with the
   * requester and every material of the request.
   */
  saveAppointment(
    change: StatusChange,
    date: Date,
    notification: NotificationDraft | null,
  ): Promise<SavedAppointment>;
}
