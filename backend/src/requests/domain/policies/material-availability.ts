/**
 * The material statuses «Agendar cita» refuses (HU-20). EN_RESTAURACION and
 * NO_CONSULTABLE block the scheduling; EN_USO does not, because it only
 * applies to the day the material is in the reading room (HU-72).
 */
const BLOCKING_STATUSES: readonly string[] = [
  'EN_RESTAURACION',
  'NO_CONSULTABLE',
];

/** Whether a material in this status cannot be booked for an appointment. */
export function blocksScheduling(status: string): boolean {
  return BLOCKING_STATUSES.includes(status);
}
