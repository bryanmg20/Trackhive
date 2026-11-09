import { ROUTES } from '../../routes';

/** A material chosen in the search screen (HU-7.1) to include in a request. */
export interface SelectedMaterial {
  id: string;
  title: string;
  catalogCode: string;
}

export const MATERIALS_QUERY_PARAM = 'materiales';

/** `/solicitudes/nueva?materiales=<id1>,<id2>` */
export function buildNewRequestPath(materialIds: string[]): string {
  // Commas are kept literal so the URL stays readable (URLSearchParams would encode them)
  const value = materialIds.map(encodeURIComponent).join(',');
  return `${ROUTES.newRequest}?${MATERIALS_QUERY_PARAM}=${value}`;
}

/** Reads the material IDs from `?materiales=`, without blanks or repeats. */
export function readMaterialIds(search: URLSearchParams): string[] {
  const raw = search.get(MATERIALS_QUERY_PARAM) ?? '';
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
  return [...new Set(ids)];
}
