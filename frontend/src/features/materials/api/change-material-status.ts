import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import { apiUrl } from '../../auth/api/api-base-url';
import { MaterialsApiError } from './search-materials';
import type { Material } from './search-materials';

export const MAX_STATUS_REASON_LENGTH = 500;

/**
 * Statuses staff may set manually (HU-06, HU-08, HU-72).
 * EN_USO changes exclusively through reading-room delivery and return.
 */
export const MANUAL_MATERIAL_STATUSES = [
  'DISPONIBLE',
  'EN_RESTAURACION',
  'NO_CONSULTABLE',
] as const;

export type ManualMaterialStatus = (typeof MANUAL_MATERIAL_STATUSES)[number];

export interface ChangeMaterialStatusParams {
  materialId: string;
  status: ManualMaterialStatus;
  reason?: string;
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
  return 'No pudimos cambiar el estado. Inténtelo de nuevo.';
}

/** Calls the HU-08 endpoint `PATCH /api/v1/materials/:id/status`. */
export async function changeMaterialStatus(
  params: ChangeMaterialStatusParams,
): Promise<Material> {
  const response = await authenticatedFetch(
    apiUrl(`/api/v1/materials/${encodeURIComponent(params.materialId)}/status`),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: params.status,
        ...(params.reason ? { reason: params.reason } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new MaterialsApiError(
      await readErrorMessage(response),
      response.status,
    );
  }
  return (await response.json()) as Material;
}
