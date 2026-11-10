import { Material } from '../entities/material.entity';
import { MaterialStatus } from '../material-status';
import { MaterialType } from '../material-type';

export const MATERIAL_SORT_FIELDS = [
  'title',
  'catalogCode',
  'author',
  'createdAt',
] as const;

export type MaterialSortField = (typeof MATERIAL_SORT_FIELDS)[number];

export type SortOrder = 'asc' | 'desc';

export interface MaterialSearchCriteria {
  // Free text matched against title, author, catalog code and collection
  q?: string;
  type?: MaterialType;
  collection?: string;
  status?: MaterialStatus;
  sort: MaterialSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface MaterialSearchResult {
  items: Material[];
  total: number;
}

export interface IMaterialRepository {
  search(criteria: MaterialSearchCriteria): Promise<MaterialSearchResult>;
  findById(id: string): Promise<Material | null>;
  /** Saves the status and the data of the last status change (HU-08) */
  saveStatusChange(material: Material): Promise<void>;
}
