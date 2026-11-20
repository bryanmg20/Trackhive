export const MATERIAL_STATUSES = [
  'DISPONIBLE',
  'EN_USO',
  'EN_RESTAURACION',
  'NO_CONSULTABLE',
] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

/**
 * Statuses staff may assign manually (HU-06, HU-08, HU-72).
 * EN_USO is managed exclusively through material delivery and return.
 */
export const MANUAL_MATERIAL_STATUSES = [
  'DISPONIBLE',
  'EN_RESTAURACION',
  'NO_CONSULTABLE',
] as const;

export type ManualMaterialStatus = (typeof MANUAL_MATERIAL_STATUSES)[number];

export function isMaterialStatus(value: string): value is MaterialStatus {
  return (MATERIAL_STATUSES as readonly string[]).includes(value);
}

export function isManualMaterialStatus(
  value: string,
): value is ManualMaterialStatus {
  return (MANUAL_MATERIAL_STATUSES as readonly string[]).includes(value);
}
