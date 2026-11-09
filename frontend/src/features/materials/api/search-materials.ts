import { readAccessToken } from '../../auth/session';

export const MATERIAL_TYPES = [
  'DOCUMENTO',
  'PERIODICO',
  'PROTOCOLO_NOTARIAL',
  'OTRO',
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_STATUSES = [
  'DISPONIBLE',
  'EN_USO',
  'EN_RESTAURACION',
  'NO_CONSULTABLE',
] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const MATERIAL_SORT_FIELDS = [
  'title',
  'catalogCode',
  'author',
  'createdAt',
] as const;
export type MaterialSortField = (typeof MATERIAL_SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  DOCUMENTO: 'Documento',
  PERIODICO: 'Periódico',
  PROTOCOLO_NOTARIAL: 'Protocolo notarial',
  OTRO: 'Otro',
};

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  DISPONIBLE: 'Disponible',
  EN_USO: 'En uso',
  EN_RESTAURACION: 'En restauración',
  NO_CONSULTABLE: 'No consultable',
};

export interface Material {
  id: string;
  catalogCode: string;
  title: string;
  materialType: MaterialType;
  author: string | null;
  collection: string;
  status: MaterialStatus;
}

export interface MaterialPage {
  items: Material[];
  page: number;
  limit: number;
  total: number;
}

export interface SearchMaterialsParams {
  q?: string;
  type?: MaterialType;
  collection?: string;
  sort: MaterialSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

/** Thrown when the API rejects the search; `status` 401 means no valid session. */
export class MaterialsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MaterialsApiError';
    this.status = status;
  }
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
  return 'No pudimos buscar el material. Inténtelo de nuevo.';
}

/** Calls the HU-07 endpoint `GET /api/v1/materials`. */
export async function searchMaterials(
  params: SearchMaterialsParams,
): Promise<MaterialPage> {
  const query = new URLSearchParams({
    sort: params.sort,
    order: params.order,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.q) query.set('q', params.q);
  if (params.type) query.set('type', params.type);
  if (params.collection) query.set('collection', params.collection);

  const response = await fetch(`/api/v1/materials?${query}`, {
    headers: {
      Authorization: `Bearer ${readAccessToken() ?? ''}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new MaterialsApiError(
      await readErrorMessage(response),
      response.status,
    );
  }
  return (await response.json()) as MaterialPage;
}
