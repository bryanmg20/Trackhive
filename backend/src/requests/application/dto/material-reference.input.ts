import type { MaterialReferenceKind } from '../../domain/enums/material-reference-kind';

/** A material not in the catalog, described in writing (HU-09.2). */
export interface MaterialReferenceInput {
  kind: MaterialReferenceKind;
  // PROTOCOLO_NOTARIAL
  notary?: string;
  year?: number;
  deedNumber?: string;
  // TEXTO_LIBRE
  description?: string;
}
