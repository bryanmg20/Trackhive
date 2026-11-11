import { DomainError } from '../../../common/errors/domain.error';

/** A material of the request that cannot be scheduled (HU-20). */
export interface UnavailableMaterial {
  catalogCode: string;
  title: string;
  // EN_RESTAURACION or NO_CONSULTABLE
  status: string;
}

const STATUS_PHRASES: Record<string, string> = {
  EN_RESTAURACION: 'está en restauración',
  NO_CONSULTABLE: 'no es consultable',
};

/**
 * «Agendar cita» refuses a material that is EN_RESTAURACION or
 * NO_CONSULTABLE (HU-20). The message names each material and its concrete
 * status. EN_USO never gets here: it only applies to the day the material
 * is in the reading room (HU-72).
 */
export class MaterialNotAvailableError extends DomainError {
  readonly code = 'MATERIAL_NOT_AVAILABLE';

  constructor(materials: UnavailableMaterial[]) {
    super(
      materials
        .map(
          (material) =>
            `El material «${material.title}» (${material.catalogCode}) ` +
            `${STATUS_PHRASES[material.status] ?? 'no está disponible'} y no se puede agendar.`,
        )
        .join(' '),
    );
  }
}
