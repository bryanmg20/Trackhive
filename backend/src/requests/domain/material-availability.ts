import type { MaterialStatus } from '../../materials/domain/material-status';
import type { AppointmentStatus } from './appointment-status';

/**
 * Material statuses that cannot be scheduled (HU-20). EN_USO does not block:
 * it only applies to the day the material is in the reading room (HU-72).
 */
export const UNBOOKABLE_MATERIAL_STATUSES = [
  'EN_RESTAURACION',
  'NO_CONSULTABLE',
] as const satisfies readonly MaterialStatus[];

export type UnbookableMaterialStatus =
  (typeof UNBOOKABLE_MATERIAL_STATUSES)[number];

/**
 * Appointment statuses that take the day of their materials. CANCELADA and
 * NO_ASISTIO free it, so the material can be scheduled again that day. The
 * partial unique index of appointment_materials uses the same list (D-09).
 */
export const BOOKING_APPOINTMENT_STATUSES = [
  'PROGRAMADA',
  'CUMPLIDA',
] as const satisfies readonly AppointmentStatus[];

/** A material of the request, as it is on the day of the new appointment. */
export interface MaterialAvailability {
  catalogCode: string;
  title: string;
  status: MaterialStatus;
  // Tracking code of another request with an appointment for the material
  // that day, or null when the day is free
  bookedBy: string | null;
}

/** Why a material cannot be scheduled on the day of the appointment. */
export type MaterialConflict =
  | {
      reason: 'BOOKED';
      catalogCode: string;
      title: string;
      trackingCode: string;
    }
  | {
      reason: 'UNAVAILABLE';
      catalogCode: string;
      title: string;
      status: UnbookableMaterialStatus;
    };

const isUnbookable = (
  status: MaterialStatus,
): status is UnbookableMaterialStatus =>
  (UNBOOKABLE_MATERIAL_STATUSES as readonly string[]).includes(status);

/**
 * Every conflict of the materials of a request on the day of its
 * appointment (HU-20): a material already booked that day by another
 * request, or one in restoration or not consultable. Empty when all of them
 * can be scheduled. A material with both problems gives both conflicts.
 */
export function findMaterialConflicts(
  materials: readonly MaterialAvailability[],
): MaterialConflict[] {
  return materials.flatMap(
    ({ catalogCode, title, status, bookedBy }): MaterialConflict[] => [
      ...(bookedBy
        ? [
            {
              reason: 'BOOKED' as const,
              catalogCode,
              title,
              trackingCode: bookedBy,
            },
          ]
        : []),
      ...(isUnbookable(status)
        ? [{ reason: 'UNAVAILABLE' as const, catalogCode, title, status }]
        : []),
    ],
  );
}
