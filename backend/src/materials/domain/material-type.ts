export const MATERIAL_TYPES = [
  'DOCUMENTO',
  'PERIODICO',
  'PROTOCOLO_NOTARIAL',
  'OTRO',
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];

export function isMaterialType(value: string): value is MaterialType {
  return (MATERIAL_TYPES as readonly string[]).includes(value);
}
