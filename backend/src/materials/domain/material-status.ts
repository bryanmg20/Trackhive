export const MATERIAL_STATUSES = [
  'DISPONIBLE',
  'EN_USO',
  'EN_RESTAURACION',
  'NO_CONSULTABLE',
] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export function isMaterialStatus(value: string): value is MaterialStatus {
  return (MATERIAL_STATUSES as readonly string[]).includes(value);
}
