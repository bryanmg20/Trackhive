import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import type { StatusChange } from './change-request-status';
import { RequestsApiError } from './list-requests';

/**
 * A material that is not in the catalog, described in writing (HU-09.2): a
 * notarial protocol by notary, year and deed number, or any other material
 * by free text.
 */
export type MaterialReferenceKind = 'PROTOCOLO_NOTARIAL' | 'TEXTO_LIBRE';
export type MaterialReferenceStatus = 'PENDIENTE' | 'RESUELTA';

// Same limits as the backend (MaterialReferenceDto)
export const REFERENCE_NOTARY_MAX_LENGTH = 120;
export const REFERENCE_DEED_NUMBER_MAX_LENGTH = 20;
export const REFERENCE_DESCRIPTION_MIN_LENGTH = 3;
export const REFERENCE_DESCRIPTION_MAX_LENGTH = 500;
export const REFERENCE_MIN_YEAR = 1500;

/**
 * How a reference reads, as the backend decides it (HU-09.2): PENDIENTE while
 * the staff can still associate its material, SIN_MATERIAL once the request
 * went past En búsqueda without one, RESUELTA with its catalog material.
 */
export type MaterialReferenceDisplayStatus =
  | 'PENDIENTE'
  | 'RESUELTA'
  | 'SIN_MATERIAL';

export const REFERENCE_DISPLAY_STATUS_LABELS: Record<
  MaterialReferenceDisplayStatus,
  string
> = {
  PENDIENTE: 'Pendiente',
  RESUELTA: 'Resuelta',
  SIN_MATERIAL: 'Sin material asociado',
};

/** What the forms send for each reference (HU-09, HU-10.1). */
export type MaterialReferencePayload =
  | {
      kind: 'PROTOCOLO_NOTARIAL';
      notary: string;
      year: number;
      deedNumber: string;
    }
  | { kind: 'TEXTO_LIBRE'; description: string };

/** A reference in a listing: how it reads and whether it has its material. */
export interface RequestListReference {
  id: string;
  kind: MaterialReferenceKind;
  label: string;
  status: MaterialReferenceStatus;
  displayStatus: MaterialReferenceDisplayStatus;
}

/** A reference in the detail, with its material once the staff associates it. */
export interface RequestReference extends RequestListReference {
  notary: string | null;
  year: number | null;
  deedNumber: string | null;
  description: string | null;
  material: { id: string; catalogCode: string; title: string } | null;
  resolvedAt: string | null;
  resolvedBy: { id: string; name: string } | null;
}

export interface ResolveReferenceResult {
  requestId: string;
  reference: RequestReference;
  historyEntry: StatusChange;
}

/** How a draft reads before it is sent, the same text the backend builds. */
export function describeReference(reference: MaterialReferencePayload): string {
  return reference.kind === 'PROTOCOLO_NOTARIAL'
    ? `Protocolo notarial: ${reference.notary}, año ${reference.year}, escritura ${reference.deedNumber}`
    : reference.description;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
      return body.message;
    }
  } catch {
    // The response did not contain JSON.
  }
  return 'No pudimos asociar el material. Inténtelo de nuevo.';
}

/** Calls `PATCH /api/v1/requests/:id/references/:referenceId` (HU-09.2). */
export async function resolveReference(params: {
  requestId: string;
  referenceId: string;
  materialId: string;
}): Promise<ResolveReferenceResult> {
  const response = await authenticatedFetch(
    apiUrl(
      `/api/v1/requests/${encodeURIComponent(params.requestId)}/references/${encodeURIComponent(params.referenceId)}`,
    ),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ materialId: params.materialId }),
    },
  );
  if (!response.ok) {
    throw new RequestsApiError(
      await readErrorMessage(response),
      response.status,
    );
  }
  return (await response.json()) as ResolveReferenceResult;
}
