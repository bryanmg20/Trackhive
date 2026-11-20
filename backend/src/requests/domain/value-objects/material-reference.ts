import type { MaterialReferenceKind } from '../enums/material-reference-kind';
import { isMaterialReferenceKind } from '../enums/material-reference-kind';
import type { MaterialReferenceStatus } from '../enums/material-reference-status';
import { InvalidMaterialReferenceError } from '../errors/invalid-material-reference.error';

export const REFERENCE_NOTARY_MAX_LENGTH = 120;
export const REFERENCE_DEED_NUMBER_MAX_LENGTH = 20;
export const REFERENCE_DESCRIPTION_MIN_LENGTH = 3;
export const REFERENCE_DESCRIPTION_MAX_LENGTH = 500;
// The oldest notarial protocols of the archive are colonial
export const REFERENCE_MIN_YEAR = 1500;

/**
 * What the requester writes about a material that is not in the catalog
 * (HU-09.2). A notarial protocol: notary, year and deed number. Any other
 * material: free text, for example «El Heraldo, 15-03-1950».
 */
export interface MaterialReferenceData {
  kind: MaterialReferenceKind;
  notary?: string | null;
  year?: number | null;
  deedNumber?: string | null;
  description?: string | null;
}

/** A written reference of a request and whether it has its material yet. */
export interface MaterialReference {
  readonly id: string;
  readonly kind: MaterialReferenceKind;
  readonly notary: string | null;
  readonly year: number | null;
  readonly deedNumber: string | null;
  readonly description: string | null;
  readonly status: MaterialReferenceStatus;
  // The catalog material it was associated with; null while PENDIENTE
  readonly materialId: string | null;
}

function requiredText(
  value: string | null | undefined,
  maxLength: number,
  message: string,
): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '' || trimmed.length > maxLength) {
    throw new InvalidMaterialReferenceError(message);
  }
  return trimmed;
}

/**
 * Validates a reference and keeps only the data of its kind. Throws
 * InvalidMaterialReferenceError (400) when something its kind requires is
 * missing or out of range.
 */
export function createMaterialReference(
  id: string,
  data: MaterialReferenceData,
  now: Date = new Date(),
): MaterialReference {
  if (!isMaterialReferenceKind(data.kind)) {
    throw new InvalidMaterialReferenceError(
      'El tipo de referencia no es válido.',
    );
  }

  if (data.kind === 'TEXTO_LIBRE') {
    const description = requiredText(
      data.description,
      REFERENCE_DESCRIPTION_MAX_LENGTH,
      `Describa el material en máximo ${REFERENCE_DESCRIPTION_MAX_LENGTH} caracteres.`,
    );
    if (description.length < REFERENCE_DESCRIPTION_MIN_LENGTH) {
      throw new InvalidMaterialReferenceError(
        `Describa el material con al menos ${REFERENCE_DESCRIPTION_MIN_LENGTH} caracteres.`,
      );
    }
    return Object.freeze({
      id,
      kind: data.kind,
      notary: null,
      year: null,
      deedNumber: null,
      description,
      status: 'PENDIENTE',
      materialId: null,
    });
  }

  const notary = requiredText(
    data.notary,
    REFERENCE_NOTARY_MAX_LENGTH,
    `Indique la notaría en máximo ${REFERENCE_NOTARY_MAX_LENGTH} caracteres.`,
  );
  const deedNumber = requiredText(
    data.deedNumber,
    REFERENCE_DEED_NUMBER_MAX_LENGTH,
    `Indique el número de escritura en máximo ${REFERENCE_DEED_NUMBER_MAX_LENGTH} caracteres.`,
  );
  const currentYear = now.getUTCFullYear();
  const year = data.year;
  if (
    typeof year !== 'number' ||
    !Number.isInteger(year) ||
    year < REFERENCE_MIN_YEAR ||
    year > currentYear
  ) {
    throw new InvalidMaterialReferenceError(
      `El año de la escritura debe estar entre ${REFERENCE_MIN_YEAR} y ${currentYear}.`,
    );
  }
  return Object.freeze({
    id,
    kind: data.kind,
    notary,
    year,
    deedNumber,
    description: null,
    status: 'PENDIENTE',
    materialId: null,
  });
}

/** How a reference reads in the history and on the screens. */
export function describeMaterialReference(
  reference: Pick<
    MaterialReference,
    'kind' | 'notary' | 'year' | 'deedNumber' | 'description'
  >,
): string {
  if (reference.kind === 'PROTOCOLO_NOTARIAL') {
    return `Protocolo notarial: ${reference.notary ?? ''}, año ${reference.year ?? ''}, escritura ${reference.deedNumber ?? ''}`;
  }
  return reference.description ?? '';
}
