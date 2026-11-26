import {
  compact,
  readEnum,
  readPage,
  readText,
  SORT_ORDERS,
} from '../navigation/url-params';
import {
  MATERIAL_SORT_FIELDS,
  MATERIAL_STATUSES,
  MATERIAL_TYPES,
} from './api/search-materials';
import type { SearchMaterialsParams } from './api/search-materials';

const PAGE_SIZE = 10;

export const DEFAULT_MATERIAL_PARAMS: SearchMaterialsParams = {
  sort: 'title',
  order: 'asc',
  page: 1,
  limit: PAGE_SIZE,
};

/** Staff search kept in the URL, e.g. «?q=acta&type=DOCUMENTO&page=2». */
export function parseStaffMaterialParams(
  search: URLSearchParams,
): SearchMaterialsParams {
  return compact({
    q: readText(search, 'q'),
    type: readEnum(search, 'type', MATERIAL_TYPES),
    collection: readText(search, 'collection'),
    status: readEnum(search, 'status', MATERIAL_STATUSES),
    sort:
      readEnum(search, 'sort', MATERIAL_SORT_FIELDS) ??
      DEFAULT_MATERIAL_PARAMS.sort,
    order: readEnum(search, 'order', SORT_ORDERS) ?? DEFAULT_MATERIAL_PARAMS.order,
    page: readPage(search),
    limit: PAGE_SIZE,
  });
}

/** Public search: the same, without the status filter it does not offer. */
export function parsePublicMaterialParams(
  search: URLSearchParams,
): SearchMaterialsParams {
  return compact({ ...parseStaffMaterialParams(search), status: undefined });
}
