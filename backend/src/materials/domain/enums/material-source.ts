// Where the material record comes from (HU-134): registered by hand by the
// staff, or brought by the Everything sync (HU-137)
export const MATERIAL_SOURCES = ['MANUAL', 'EVERYTHING'] as const;

export type MaterialSource = (typeof MATERIAL_SOURCES)[number];

export function isMaterialSource(value: string): value is MaterialSource {
  return (MATERIAL_SOURCES as readonly string[]).includes(value);
}
