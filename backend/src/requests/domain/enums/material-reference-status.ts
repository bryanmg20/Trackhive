/**
 * PENDIENTE until the staff associates the catalog material it describes,
 * normally the one the sync brought after digitizing it; then RESUELTA (HU-09.2).
 */
export const MATERIAL_REFERENCE_STATUSES = ['PENDIENTE', 'RESUELTA'] as const;

export type MaterialReferenceStatus =
  (typeof MATERIAL_REFERENCE_STATUSES)[number];

export function isMaterialReferenceStatus(
  value: string,
): value is MaterialReferenceStatus {
  return (MATERIAL_REFERENCE_STATUSES as readonly string[]).includes(value);
}
