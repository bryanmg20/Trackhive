/**
 * How a written reference reads on the screens (HU-09.2). PENDIENTE while
 * the request is RECIBIDA or EN_BUSQUEDA and the staff can still associate
 * its material; SIN_MATERIAL once the request went past that without one;
 * RESUELTA when it has its catalog material.
 */
export const MATERIAL_REFERENCE_DISPLAY_STATUSES = [
  'PENDIENTE',
  'RESUELTA',
  'SIN_MATERIAL',
] as const;

export type MaterialReferenceDisplayStatus =
  (typeof MATERIAL_REFERENCE_DISPLAY_STATUSES)[number];
