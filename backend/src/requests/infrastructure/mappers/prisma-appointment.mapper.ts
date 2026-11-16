import type { Prisma } from '@prisma/client';
import type { SavedAppointment } from '../../domain/value-objects/saved-appointment';
import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';
import type { StatusChange } from '../../domain/value-objects/status-change';

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
