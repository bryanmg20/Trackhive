/**
 * What a request needs to know of each of its catalog materials to skip the
 * search (HU-139): whether the Everything sync found its digital copy and
 * its status (DISPONIBLE, EN_USO, EN_RESTAURACION or NO_CONSULTABLE).
 */
export interface MaterialDigitalCopy {
  hasDigitalCopy: boolean;
  status: string;
}

/**
 * What the repository tells the Request about the digital copies of its
 * materials (HU-139), so the entity decides whether RECIBIDA can go straight
 * to DISPONIBLE.
 */
export interface DigitalCopySummary {
  allMaterialsHaveDigitalCopy: boolean;
  anyMaterialNotConsultable: boolean;
}

/**
 * Summarizes the materials of a request (HU-139). Without catalog materials
 * there is no copy to send, so it is not «all have a copy». Only
 * NO_CONSULTABLE counts as a restriction: it may also forbid sending the
 * copy (assumption not confirmed with the CLENA). EN_RESTAURACION does not,
 * because the restoration affects the original and not the copy.
 */
export function summarizeDigitalCopies(
  materials: readonly MaterialDigitalCopy[],
): DigitalCopySummary {
  return {
    allMaterialsHaveDigitalCopy:
      materials.length > 0 &&
      materials.every((material) => material.hasDigitalCopy),
    anyMaterialNotConsultable: materials.some(
      (material) => material.status === 'NO_CONSULTABLE',
    ),
  };
}
