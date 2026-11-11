import { ROUTES } from '../../routes';
import type { UserRole } from '../auth/session';

export interface Section {
  to: string;
  label: string;
  roles: readonly UserRole[];
}

const STAFF_ROLES: readonly UserRole[] = ['PERSONAL', 'ADMIN'];

/**
 * Sections available in the menu, with the roles allowed to open them.
 * A section must also have a matching route guard in `App.tsx`.
 */
export const SECTIONS: readonly Section[] = [
  {
    to: ROUTES.materials,
    label: 'Buscar material',
    roles: ['PUBLICO'],
  },
  {
    to: ROUTES.myRequests,
    label: 'Mis solicitudes',
    roles: ['PUBLICO'],
  },
  {
    to: ROUTES.requests,
    label: 'Solicitudes',
    roles: STAFF_ROLES,
  },
  {
    to: ROUTES.calendar,
    label: 'Calendario',
    roles: STAFF_ROLES,
  },
  {
    to: ROUTES.staffMaterials,
    label: 'Material',
    roles: STAFF_ROLES,
  },
];

export function sectionsForRole(role: UserRole | null): Section[] {
  if (!role) {
    return [];
  }

  return SECTIONS.filter((section) => section.roles.includes(role));
}
