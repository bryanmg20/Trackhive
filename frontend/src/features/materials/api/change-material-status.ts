import { readAccessToken } from '../../auth/session';
import { MaterialsApiError } from './search-materials';
import type { Material, MaterialStatus } from './search-materials';

export const MAX_STATUS_REASON_LENGTH = 500;

export interface ChangeMaterialStatusParams {
  materialId: string;
  status: MaterialStatus;
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
  const response = await fetch(
    `/api/v1/materials/${encodeURIComponent(params.materialId)}/status`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${readAccessToken() ?? ''}`,
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
