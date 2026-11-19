import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import {
  networkRequestApiError,
  readRequestApiError,
} from '../../requests/api/request-api-error';

/** Same limits as the backend (MostRequestedMaterialsQueryDto). */
export const RANKING_LIMITS = [10, 20, 50] as const;
export type RankingLimit = (typeof RANKING_LIMITS)[number];

export interface MaterialRankingItem {
  // Equal counts share the rank (1, 2, 2, 4)
  rank: number;
  materialId: string;
  catalogCode: string;
  title: string;
  materialType: string;
  requestCount: number;
}

export interface MostRequestedMaterials {
  from: string | null;
  to: string | null;
  totalRequests: number;
  items: MaterialRankingItem[];
}

export interface MostRequestedMaterialsParams {
  // YYYY-MM-DD, both included, in America/Bogota
  from?: string;
  to?: string;
  limit: RankingLimit;
}

/**
 * Calls the HU-26 endpoint `GET /api/v1/reports/most-requested-materials`
 * (PERSONAL and ADMIN).
 */
export async function getMostRequestedMaterials(
  params: MostRequestedMaterialsParams,
): Promise<MostRequestedMaterials> {
  const query = new URLSearchParams({ limit: String(params.limit) });
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);

  let response: Response;
  try {
    response = await authenticatedFetch(
      apiUrl(`/api/v1/reports/most-requested-materials?${query}`),
      { headers: { Accept: 'application/json' } },
    );
  } catch {
    throw networkRequestApiError();
  }
  if (!response.ok) {
    throw await readRequestApiError(response);
  }
  return (await response.json()) as MostRequestedMaterials;
}

/** Width of a bar as a share of the largest count, so any range fits. */
export function barWidth(count: number, max: number): string {
  if (max <= 0) return '0%';
  return `${Math.round((count / max) * 1000) / 10}%`;
}
