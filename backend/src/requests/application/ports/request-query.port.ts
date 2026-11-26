import type { MaterialReviewReason } from '../../../materials/domain/enums/material-review-reason';
import type { AppointmentStatus } from '../../domain/enums/appointment-status';
import type { DeliveryMode } from '../../domain/enums/delivery-mode';
import type { RequestStatus } from '../../domain/enums/request-status';
import type { MaterialReference } from '../../domain/value-objects/material-reference';
import type { AppointmentLoanCounts } from '../../domain/policies/appointment-loans';
import type { ReportPeriod } from '../../domain/policies/report-period';
import type { DayOccupancyCount } from '../../domain/value-objects/room-capacity';

export interface RequesterProfile {
  municipality?: string | null;
  ageRange?: string | null;
  populationGroup?: string | null;
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
  // Only RECIBIDA or EN_BUSQUEDA requests with a reference without material (HU-09.2)
  pendingReferences?: boolean;
  sort: RequestSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

/**
 * A written reference of the request as the detail shows it (HU-09.2): its
 * catalog material, who associated it and when; all null while PENDIENTE.
 * Whole MaterialReference, so the detail can rebuild the Request with it.
 */
export interface RequestDetailReference extends MaterialReference {
  material: { id: string; catalogCode: string; title: string } | null;
  resolvedAt: Date | null;
  resolvedBy: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  } | null;
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
  // Written references (HU-09.2), oldest first
  references: Omit<MaterialReference, 'materialId'>[];
}

export interface RequestListResult {
  items: RequestListItem[];
  total: number;
}

export interface AppointmentMaterialLoanSummary {
  id: string;
  handedOverAt: Date;
  handedOverBy: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  };
  deliveryNotes: string | null;
  returnedAt: Date | null;
  returnedBy: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  } | null;
  returnNotes: string | null;
}

export interface RequestDetailActiveAppointment {
  id: string;
  appointmentDate: Date;
  status: AppointmentStatus;
  materials: {
    id: string;
    catalogCode: string;
    title: string;
    status: string;
    activeLoan: AppointmentMaterialLoanSummary | null;
    lastLoan: AppointmentMaterialLoanSummary | null;
  }[];
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
    itemStatus: string;
    // Whether the sync found its digital copy (HU-139); never the full path
    hasDigitalCopy: boolean;
    // Leaf folder name in Everything for staff search (HU-140)
    digitalFolderName: string | null;
    needsReview: boolean;
    reviewReason: MaterialReviewReason | null;
  }[];
  // Written references (HU-09.2), oldest first
  references: RequestDetailReference[];
  activeAppointment?: RequestDetailActiveAppointment | null;
}

/** One row of status_history, with the name of who made the change (HU-17). */
export interface RequestHistoryEntry {
  id: string;
  // NULL only in the row of the creation
  previousStatus: RequestStatus | null;
  newStatus: RequestStatus;
  changedAt: Date;
  comment: string | null;
  visibleToRequester: boolean;
  changedBy: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  };
}

/** The timeline of a request, oldest change first (HU-17). */
export interface RequestHistory {
  requestId: string;
  trackingCode: string;
  // The account linked to the requester; NULL for a visitor without account
  requesterUserId: string | null;
  entries: RequestHistoryEntry[];
}

/** What the email of a status change needs to know of the request (HU-23, HU-24). */
export interface RequestNotificationContext {
  trackingCode: string;
  deliveryMode: DeliveryMode;
  requester: {
    firstName: string;
    lastName: string;
    // NULL when the requester only left a phone: there is nobody to email
    email: string | null;
  };
  materials: { catalogCode: string; title: string }[];
  // Written references without an associated catalog material (HU-09.2, HU-24)
  references: string[];
}

/** A material of the request, as the scheduling checks read it (HU-20). */
export interface SchedulableMaterial {
  id: string;
  catalogCode: string;
  title: string;
  // DISPONIBLE, EN_USO, EN_RESTAURACION or NO_CONSULTABLE
  status: string;
}

/** A PROGRAMADA appointment that already holds a material on a day (HU-20). */
export interface MaterialDayBooking {
  materialId: string;
  catalogCode: string;
  title: string;
  // UTC midnight of the day
  date: Date;
  trackingCode: string;
}

/** What «Agendar cita» checks before saving anything (HU-20). */
export interface SchedulingConflicts {
  materials: SchedulableMaterial[];
  bookedMaterials: MaterialDayBooking[];
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
    status?: string;
    activeLoan?: AppointmentMaterialLoanSummary | null;
    lastLoan?: AppointmentMaterialLoanSummary | null;
  }[];
}

export interface AppointmentListResult {
  items: AppointmentListItem[];
  total: number;
}

/** Which requests the ranking counts and how many materials it returns (HU-26). */
export interface MostRequestedMaterialsCriteria {
  // Bounds of registered_at: start included, end excluded
  period: ReportPeriod;
  limit: number;
}

/** A material of the ranking and the requests that include it (HU-26). */
export interface MaterialRequestCount {
  materialId: string;
  catalogCode: string;
  title: string;
  materialType: string;
  requestCount: number;
}

export interface MostRequestedMaterialsResult {
  // Most requested first; ties by title
  items: MaterialRequestCount[];
  // Requests registered in the period, whatever their material
  totalRequests: number;
}

/**
 * What the use cases read and that is not the Request entity (D-D): the
 * listings and the detail of the screens, the context of the email and the
 * checks of «Agendar cita». The entity is saved and loaded with
 * IRequestRepository.
 */
export interface IRequestQueryService {
  list(criteria: RequestListCriteria): Promise<RequestListResult>;

  /**
   * Only the requests whose requester is linked to this user account: the
   * ones the user radicated and the ones the staff registered for them.
   */
  listByRequesterUser(
    userId: string,
    criteria: MyRequestListCriteria,
  ): Promise<RequestListResult>;

  /** Everything the detail screen shows (HU-13). */
  findDetail(id: string): Promise<RequestDetail | null>;

  /**
   * Every row of status_history of the request, oldest first, and the
   * account of its requester to check who may read it (HU-17).
   */
  findHistory(id: string): Promise<RequestHistory | null>;

  listAppointments(
    criteria: AppointmentListCriteria,
  ): Promise<AppointmentListResult>;

  /** A requester, or a user account without a requester yet (HU-10). */
  findRequesterByEmail(email: string): Promise<RequesterProfile | null>;

  /** Tracking code, requester and materials for the status email (HU-23). */
  findNotificationContext(
    id: string,
  ): Promise<RequestNotificationContext | null>;

  /**
   * The materials of the request and the PROGRAMADA appointments that
   * already hold any of them on `date` (HU-20). The use case blocks the
   * materials that are EN_RESTAURACION or NO_CONSULTABLE and the days
   * already taken before anything is saved.
   */
  findSchedulingConflicts(
    requestId: string,
    date: Date,
  ): Promise<SchedulingConflicts>;

  /** The ids of this list that are not a material of the catalog (RN-04). */
  findMissingMaterialIds(materialIds: readonly string[]): Promise<string[]>;

  /** Active appointments (PROGRAMADA or CUMPLIDA) on a UTC date-only day. */
  countActiveAppointmentsOnDate(date: Date): Promise<number>;

  /** Active appointment counts grouped by day for a UTC date-only range. */
  countActiveAppointmentsByDateRange(
    from: Date,
    to: Date,
  ): Promise<DayOccupancyCount[]>;

  /**
   * The materials included in the most requests registered in the period,
   * whatever their status (HU-26). A request counts once per material.
   */
  findMostRequestedMaterials(
    criteria: MostRequestedMaterialsCriteria,
  ): Promise<MostRequestedMaterialsResult>;

  /**
   * Total and open (`returned_at IS NULL`) material loans recorded for an
   * appointment, used by the appointment-loans policy before cancelling or
   * rescheduling (HU-21, HU-72, RN-20).
   */
  countAppointmentLoans(appointmentId: string): Promise<AppointmentLoanCounts>;

  /**
   * Total and open (`returned_at IS NULL`) material loans of the PROGRAMADA
   * appointment of a request, used by the appointment-loans policy before
   * settling the request as ATENDIDA or DISPONIBLE (HU-15, HU-72).
   */
  countScheduledAppointmentLoansByRequest(
    requestId: string,
  ): Promise<AppointmentLoanCounts>;
}
