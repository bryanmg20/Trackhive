import { User } from '../entities/user.entity';
import type { UserRole } from '../enums/user-role';

export const USER_SORT_FIELDS = [
  'lastName',
  'firstName',
  'email',
  'role',
  'createdAt',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export type SortOrder = 'asc' | 'desc';

/** Filters, order and page of the staff accounts listing (HU-05). */
export interface UserSearchCriteria {
  // Every word must match one of the four name fields or the email
  q?: string;
  // Only accounts with one of these roles
  roles: readonly UserRole[];
  active?: boolean;
  sort: UserSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface UserSearchResult {
  items: User[];
  total: number;
}

export interface IUserRepository {
  save(user: User): Promise<void>;
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  search(criteria: UserSearchCriteria): Promise<UserSearchResult>;
}
