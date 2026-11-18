import type { Request } from '../entities/request.entity';
import type { AppointmentStatus } from '../enums/appointment-status';
import type { SavedStatusChange } from './saved-status-change';

/** An appointment loaded with its request entity to reschedule or cancel it (HU-21). */
export interface StoredAppointment {
  readonly id: string;
  // UTC midnight of the day
  readonly date: Date;
  readonly status: AppointmentStatus;
  readonly request: Request;
}

/** An appointment as it was saved (HU-18, HU-21), with the names to show. */
export interface SavedAppointment {
  readonly id: string;
  // UTC midnight of the day
  readonly date: Date;
  readonly status: 'PROGRAMADA';
  readonly requester: {
    readonly id: string;
    readonly firstName: string;
    readonly middleName: string | null;
    readonly lastName: string;
    readonly secondLastName: string | null;
  };
  readonly materials: { id: string; catalogCode: string; title: string }[];
  readonly statusChange: SavedStatusChange;
}

/** A cancelled appointment as it was saved (HU-21). */
export interface SavedCancelledAppointment {
  readonly id: string;
  // UTC midnight of the day
  readonly date: Date;
  readonly status: 'CANCELADA';
  readonly statusChange: SavedStatusChange;
}
