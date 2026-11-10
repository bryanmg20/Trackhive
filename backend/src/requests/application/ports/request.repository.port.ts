import type { NotificationDraft } from '../../../notifications/domain/notification-draft';
import type { AppointmentStatus } from '../../domain/appointment-status';
import type { DeliveryMode } from '../../domain/delivery-mode';
import type { Request } from '../../domain/entities/request.entity';
import type { RequestStatus } from '../../domain/request-status';
import type { StatusChange } from '../../domain/status-change';
import type { CreateRequestInput } from '../use-cases/create-request.use-case';
import type { CreateRequestOnBehalfInput } from '../use-cases/create-request-on-behalf.use-case';

export interface CreatedRequest {
  id: string;
  trackingCode: string;
  status: 'RECIBIDA';
}

export interface RequesterProfile {
  requesterId: string | null;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
  phone: string | null;
  requesterType: string | null;
  institution: string | null;
  documentType: string | null;
  documentNumber: string | null;
  foundIn: 'REQUESTER' | 'USER';
}

export const REQUEST_SORT_FIELDS = ['registeredAt', 'desiredDate'] as const;

export type RequestSortField = (typeof REQUEST_SORT_FIELDS)[number];

export type SortOrder = 'asc' | 'desc';

export interface RequestListCriteria {
  status?: RequestStatus;
  // Desired date range, both ends included, as YYYY-MM-DD
  desiredFrom?: string;
  desiredTo?: string;
  // Free text matched against the requester's names, email and document number
  requester?: string;
  // Free text matched against the title or catalog code of a requested material
  material?: string;
  sort: RequestSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

/** «Mis solicitudes» (HU-11): only the status filter, the order and the page. */
export type MyRequestListCriteria = Pick<
  RequestListCriteria,
  'status' | 'sort' | 'order' | 'page' | 'limit'
>;

export interface RequestListItem {
  id: string;
  trackingCode: string;
  status: RequestStatus;
  deliveryMode: DeliveryMode;
  desiredDate: Date;
  registeredAt: Date;
  // Only for RECHAZADA (HU-16)
  rejectionReason: string | null;
  requester: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
    email: string | null;
  };
  materials: { id: string; catalogCode: string; title: string }[];
}

export interface RequestListResult {
  items: RequestListItem[];
  total: number;
}

export interface RequestDetail {
  id: string;
  trackingCode: string;
  status: RequestStatus;
  deliveryMode: DeliveryMode;
  originChannel: string;
  reason: string | null;
  requirementDescription: string;
  desiredDate: Date;
  committedDate: Date | null;
  registeredAt: Date;
  rejectionReason: string | null;
  requester: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
    email: string | null;
    phone: string | null;
    requesterType: string;
    institution: string | null;
    documentType: string | null;
    documentNumber: string | null;
  };
  materials: {
    id: string;
    catalogCode: string;
    title: string;
    materialType: string;
    author: string | null;
    collection: string;
    status: string;
    location: { depot: string; shelf: string; box: string };
    itemStatus: string;
  }[];
}

/** A row of status_history as it was saved, with the name of who made it. */
export interface SavedStatusChange {
  previousStatus: RequestStatus;
  newStatus: RequestStatus;
  changedAt: Date;
  comment: string | null;
  changedBy: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  };
}

/** What the email of a status change needs to know of the request (HU-23). */
export interface RequestNotificationContext {
  trackingCode: string;
  requester: {
    firstName: string;
    lastName: string;
    // NULL when the requester only left a phone: there is nobody to email
    email: string | null;
  };
  materials: { catalogCode: string; title: string }[];
}

/** An appointment as it was saved (HU-18), with the names to show. */
export interface SavedAppointment {
  id: string;
  // UTC midnight of the day
  date: Date;
  status: 'PROGRAMADA';
  requester: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  };
  materials: { id: string; catalogCode: string; title: string }[];
  statusChange: SavedStatusChange;
}

export const APPOINTMENT_SORT_FIELDS = [
  'appointmentDate',
  'createdAt',
] as const;

export type AppointmentSortField = (typeof APPOINTMENT_SORT_FIELDS)[number];

export interface AppointmentListCriteria {
  status?: AppointmentStatus;
  // Appointment date range, both ends included, as YYYY-MM-DD
  from?: string;
  to?: string;
  // Free text matched against the requester's names, email and document number
  requester?: string;
  // Free text matched against the title or catalog code of an appointment material
  material?: string;
  sort: AppointmentSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface AppointmentListItem {
  id: string;
  appointmentDate: Date;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: Date;
  request: {
    id: string;
    trackingCode: string;
    status: RequestStatus;
    deliveryMode: DeliveryMode;
  };
  requester: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
    email: string | null;
    phone: string | null;
    requesterType: string;
    institution: string | null;
    documentType: string | null;
    documentNumber: string | null;
  };
  scheduledBy: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  };
  materials: {
    id: string;
    catalogCode: string;
    title: string;
    materialType: string;
    depot: string;
    shelf: string;
    box: string;
  }[];
}

export interface AppointmentListResult {
  items: AppointmentListItem[];
  total: number;
}

export interface RequestRepository {
  create(
    input: CreateRequestInput & { createdById: string },
  ): Promise<CreatedRequest>;

  createOnBehalf(
    input: CreateRequestOnBehalfInput & { createdById: string },
  ): Promise<CreatedRequest>;

  findRequesterByEmail(email: string): Promise<RequesterProfile | null>;

  list(criteria: RequestListCriteria): Promise<RequestListResult>;

  listAppointments(
    criteria: AppointmentListCriteria,
  ): Promise<AppointmentListResult>;

  findById(id: string): Promise<RequestDetail | null>;
  /**
   * Only the requests whose requester is linked to this user account: the
   * ones the user radicated and the ones the staff registered for them.
   */
  listByRequesterUser(
    userId: string,
    criteria: MyRequestListCriteria,
  ): Promise<RequestListResult>;

  /** The request as a domain entity, to apply its transition rules (HU-15). */
  findEntityById(id: string): Promise<Request | null>;

  /** Tracking code, requester and materials for the status email (HU-23). */
  findNotificationContext(
    id: string,
  ): Promise<RequestNotificationContext | null>;

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
