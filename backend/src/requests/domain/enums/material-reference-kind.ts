/**
 * How a material that is not in the catalog is described (HU-09.2): a
 * notarial protocol by notary, year and deed number, or any other material
 * by free text.
 */
export const MATERIAL_REFERENCE_KINDS = [
  'PROTOCOLO_NOTARIAL',
  'TEXTO_LIBRE',
] as const;

export type MaterialReferenceKind = (typeof MATERIAL_REFERENCE_KINDS)[number];

export function isMaterialReferenceKind(
  value: string,
): value is MaterialReferenceKind {
  return (MATERIAL_REFERENCE_KINDS as readonly string[]).includes(value);
}
