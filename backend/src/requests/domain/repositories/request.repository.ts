import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import type { Request } from '../entities/request.entity';
import type {
  ReferenceResolution,
  SavedReferenceResolution,
} from '../value-objects/reference-resolution';
import type {
  SavedAppointment,
  SavedCancelledAppointment,
  StoredAppointment,
} from '../value-objects/saved-appointment';
import type { SavedStatusChange } from '../value-objects/saved-status-change';
import type { StatusChange } from '../value-objects/status-change';

/**
 * Saves and loads the Request entity (R3). What is only read to show on a
 * screen lives in IRequestQueryService (D-D).
 */
export interface IRequestRepository {
  /** Inserts a new request (Request.create) with its materials (HU-09, HU-10). */
  save(request: Request): Promise<void>;

  /**
   * The request as a domain entity, with its written references and whether
   * its materials all have a digital copy and any is NO_CONSULTABLE, to
   * apply its transition rules (HU-15, HU-09.2, HU-139).
   */
  findById(id: string): Promise<Request | null>;

  /**
   * Associates the catalog material with a pending reference in one
   * transaction (HU-09.2): marks it RESUELTA with who and when, adds the
   * material to the request if it was not there and inserts the history row.
   * Throws MaterialReferenceAlreadyResolvedError when someone resolved it
   * first, or RequestStatusConflictError when the status changed meanwhile;
   * then nothing is saved.
   */
  saveReferenceResolution(
    resolution: ReferenceResolution,
  ): Promise<SavedReferenceResolution>;

  /** An appointment with its request entity, to reschedule or cancel it (HU-21). */
  findAppointmentById(id: string): Promise<StoredAppointment | null>;

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

  /**
   * Reschedules a PROGRAMADA appointment to `date` in one transaction (HU-21):
   * checks room capacity, updates the appointment and its booked materials to
   * the new day, inserts the status_history row and queues the email.
   */
  rescheduleAppointment(
    appointmentId: string,
    change: StatusChange,
    date: Date,
    notification: NotificationDraft | null,
  ): Promise<SavedAppointment>;

  /**
   * Cancels a PROGRAMADA appointment in one transaction (HU-21): moves the
   * request back to DISPONIBLE, marks the appointment CANCELADA, releases the
   * booked day of its materials, inserts the status_history row and queues
   * the email.
   */
  cancelAppointment(
    appointmentId: string,
    change: StatusChange,
    notification: NotificationDraft | null,
  ): Promise<SavedCancelledAppointment>;
}
