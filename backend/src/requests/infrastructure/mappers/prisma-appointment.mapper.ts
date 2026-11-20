import type { Prisma } from '@prisma/client';
import { isAppointmentStatus } from '../../domain/enums/appointment-status';
import type {
  SavedAppointment,
  SavedCancelledAppointment,
  StoredAppointment,
} from '../../domain/value-objects/saved-appointment';
import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';
import type { StatusChange } from '../../domain/value-objects/status-change';
import { PrismaRequestMapper } from './prisma-request.mapper';
import type { RequestEntityRow } from './prisma-request.mapper';

/** A new appointment of a request, with every material of the request. */
export interface NewAppointment {
  id: string;
  requestId: string;
  requesterId: string;
  scheduledById: string;
  // UTC midnight of the day
  date: Date;
  materialIds: string[];
}

/** An appointment loaded with its request row and booked materials (HU-21, HU-72). */
export interface StoredAppointmentRow {
  id: string;
  appointmentDate: Date;
  status: string;
  materials: { materialId: string }[];
  request: RequestEntityRow;
}

/** An appointment just inserted, with the names to show (HU-18). */
export interface InsertedAppointmentRow {
  id: string;
  appointmentDate: Date;
  requester: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
  };
  materials: { material: { id: string; catalogCode: string; title: string } }[];
}

/** Translates between the appointments tables and the appointment records. */
export class PrismaAppointmentMapper {
  static toStoredAppointment(row: StoredAppointmentRow): StoredAppointment {
    if (!isAppointmentStatus(row.status)) {
      throw new Error(`Appointment ${row.id} has an invalid stored status`);
    }
    return {
      id: row.id,
      date: row.appointmentDate,
      status: row.status,
      materialIds: row.materials.map(({ materialId }) => materialId),
      request: PrismaRequestMapper.toDomain(row.request),
    };
  }

  /** A PROGRAMADA appointment that books each material for the day (HU-20). */
  static toPersistence(
    appointment: NewAppointment,
  ): Prisma.AppointmentModelUncheckedCreateInput {
    return {
      id: appointment.id,
      requestId: appointment.requestId,
      requesterId: appointment.requesterId,
      scheduledById: appointment.scheduledById,
      appointmentDate: appointment.date,
      status: 'PROGRAMADA',
      materials: {
        create: appointment.materialIds.map((materialId) => ({
          materialId,
          bookedDate: appointment.date,
        })),
      },
    };
  }

  static toSavedAppointment(
    row: InsertedAppointmentRow,
    statusChange: SavedStatusChange,
  ): SavedAppointment {
    return {
      id: row.id,
      date: row.appointmentDate,
      status: 'PROGRAMADA',
      requester: row.requester,
      materials: row.materials.map(({ material }) => material),
      statusChange,
    };
  }

  static toSavedCancelledAppointment(
    row: { id: string; appointmentDate: Date },
    statusChange: SavedStatusChange,
  ): SavedCancelledAppointment {
    return {
      id: row.id,
      date: row.appointmentDate,
      status: 'CANCELADA',
      statusChange,
    };
  }

  /** Moves a PROGRAMADA appointment to a new date (HU-21). */
  static toRescheduled(
    date: Date,
    scheduledById: string,
  ): Prisma.AppointmentModelUncheckedUpdateManyInput {
    return { appointmentDate: date, scheduledById };
  }

  /** Updates the booked day of the materials of a rescheduled appointment (HU-21). */
  static toMaterialBookedDate(
    date: Date,
  ): Prisma.AppointmentMaterialModelUpdateManyMutationInput {
    return { bookedDate: date };
  }

  /** How the change settled the appointment (StatusChange.appointmentOutcome). */
  static toSettled(
    outcome: NonNullable<StatusChange['appointmentOutcome']>,
  ): Prisma.AppointmentModelUpdateManyMutationInput {
    return { status: outcome };
  }

  /** The day of a material is free again: booked_date only holds a PROGRAMADA one. */
  static toBookingReleased(): Prisma.AppointmentMaterialModelUpdateManyMutationInput {
    return { bookedDate: null };
  }
}
