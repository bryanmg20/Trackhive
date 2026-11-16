import type { AppointmentStatus } from '../../domain/enums/appointment-status';
import type {
  AppointmentSortField,
  SortOrder,
} from '../ports/request-query.port';

/** The filters, order and page of the calendar (HU-19). */
export interface ListAppointmentsInput {
  status?: AppointmentStatus;
  // Appointment date range, both ends included, as YYYY-MM-DD
  from?: string;
  to?: string;
  requester?: string;
  material?: string;
  sort?: AppointmentSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}
