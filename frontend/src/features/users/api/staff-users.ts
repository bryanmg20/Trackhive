import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import {
  networkRequestApiError,
  readRequestApiError,
} from '../../requests/api/request-api-error';

export const STAFF_ROLES = ['PERSONAL', 'ADMIN'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  PERSONAL: 'Personal',
  ADMIN: 'Administrador',
};

export const STAFF_USER_SORT_FIELDS = [
  'lastName',
  'firstName',
  'email',
  'role',
  'createdAt',
] as const;
export type StaffUserSortField = (typeof STAFF_USER_SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

/** Same limits as the backend (CreateUserDto and the user entity). */
export const NAME_MAX_LENGTH = 40;
export const EMAIL_MAX_LENGTH = 160;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface StaffUser {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
  role: StaffRole;
  active: boolean;
}

export interface StaffUserPage {
  items: StaffUser[];
  page: number;
  limit: number;
  total: number;
}

export interface ListStaffUsersParams {
  q?: string;
  role?: StaffRole;
  active?: boolean;
  sort: StaffUserSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface StaffUserNames {
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
}

/** The server always creates a PERSONAL account: there is no role to send. */
export interface CreateStaffUserBody extends StaffUserNames {
  email: string;
  password: string;
}

/** The role is not editable: no account changes from PERSONAL to ADMIN. */
export type UpdateStaffUserBody = Partial<
  StaffUserNames & { email: string; active: boolean }
>;

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function send<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(apiUrl(path), init);
  } catch {
    throw networkRequestApiError();
  }
  if (!response.ok) {
    throw await readRequestApiError(response);
  }
  return (await response.json()) as T;
}

/** Calls the HU-05 endpoint `GET /api/v1/users/staff` (ADMIN only). */
export function listStaffUsers(
  params: ListStaffUsersParams,
): Promise<StaffUserPage> {
  const query = new URLSearchParams({
    sort: params.sort,
    order: params.order,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.q) query.set('q', params.q);
  if (params.role) query.set('role', params.role);
  if (params.active !== undefined) query.set('active', String(params.active));

  return send<StaffUserPage>(`/api/v1/users/staff?${query}`, {
    headers: { Accept: 'application/json' },
  });
}

/** Calls the HU-05 endpoint `POST /api/v1/users/staff` (ADMIN only). */
export function createStaffUser(body: CreateStaffUserBody): Promise<StaffUser> {
  return send<StaffUser>('/api/v1/users/staff', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/**
 * Calls the HU-05 endpoint `PATCH /api/v1/users/staff/:id` (ADMIN only).
 * Only the fields sent change; `active` deactivates or reactivates.
 */
export function updateStaffUser(
  id: string,
  body: UpdateStaffUserBody,
): Promise<StaffUser> {
  return send<StaffUser>(`/api/v1/users/staff/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** "Ana María Pérez Gómez", skipping the optional names that are empty. */
export function fullName(user: StaffUserNames): string {
  return [user.firstName, user.middleName, user.lastName, user.secondLastName]
    .filter(Boolean)
    .join(' ');
}
