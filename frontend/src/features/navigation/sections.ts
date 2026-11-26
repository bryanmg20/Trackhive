import { ROUTES } from '../../routes';
import type { UserRole } from '../auth/session';

export type SectionIcon =
  | 'home'
  | 'file'
  | 'box'
  | 'calendar'
  | 'user'
  | 'chart'
  | 'clock'
  | 'users'
  | 'settings'
  | 'sync';

export interface Section {
  to: string;
  label: string;
  icon: SectionIcon;
  roles: readonly UserRole[];
  /**
   * Other paths that belong to this section, so the menu keeps it selected
   * on child screens (WF-09 «Solicitudes» covers WF-08 and WF-10).
   */
  alsoActiveOn?: readonly RegExp[];
}

const STAFF_ROLES: readonly UserRole[] = ['PERSONAL', 'ADMIN'];

/**
 * Sections available in the menu, with the roles allowed to open them.
 * A section must also have a matching route guard in `App.tsx`.
 *
 * Order and labels follow the approved wireframes (docs/pantallas.md).
 * «Reportes» and «Tiempos de atención» are not drawn in the wireframes; they
 * are kept on purpose and the difference is recorded in docs/pantallas.md.
 */
export const SECTIONS: readonly Section[] = [
  {
    to: ROUTES.materials,
    label: 'Inicio',
    icon: 'home',
    roles: ['PUBLICO'],
    alsoActiveOn: [/^\/solicitudes\/nueva$/],
  },
  {
    to: ROUTES.myRequests,
    label: 'Mis solicitudes',
    icon: 'file',
    roles: ['PUBLICO'],
  },
  {
    to: ROUTES.requests,
    label: 'Solicitudes',
    icon: 'file',
    roles: STAFF_ROLES,
    alsoActiveOn: [/^\/solicitudes\/(?!nueva$)[^/]+$/, /^\/personal\/solicitudes\//],
  },
  {
    to: ROUTES.staffMaterials,
    label: 'Archivo',
    icon: 'box',
    roles: STAFF_ROLES,
  },
  {
    to: ROUTES.calendar,
    label: 'Calendario',
    icon: 'calendar',
    roles: STAFF_ROLES,
  },
  {
    to: ROUTES.mostRequestedMaterials,
    label: 'Reportes',
    icon: 'chart',
    roles: STAFF_ROLES,
  },
  {
    to: ROUTES.profile,
    label: 'Mi perfil',
    icon: 'user',
    roles: ['PUBLICO', 'PERSONAL', 'ADMIN'],
  },
  {
    to: ROUTES.staffUsers,
    label: 'Usuarios',
    icon: 'users',
    roles: ['ADMIN'],
  },
  {
    to: ROUTES.adminRoomCapacity,
    label: 'Capacidad sala',
    icon: 'settings',
    roles: ['ADMIN'],
  },
  {
    to: ROUTES.adminEverythingSync,
    label: 'Sincronización',
    icon: 'sync',
    roles: ['ADMIN'],
  },
  {
    to: ROUTES.attentionTimes,
    label: 'Tiempos de atención',
    icon: 'clock',
    roles: ['ADMIN'],
  },
];

export function sectionsForRole(role: UserRole | null): Section[] {
  if (!role) {
    return [];
  }

  return SECTIONS.filter((section) => section.roles.includes(role));
}

export function isSectionActive(section: Section, pathname: string): boolean {
  if (pathname === section.to) {
    return true;
  }

  return section.alsoActiveOn?.some((pattern) => pattern.test(pathname)) ?? false;
}

/** Visible name of each role, as the wireframes print it in the menu bar. */
export const ROLE_LABEL: Record<UserRole, string> = {
  PUBLICO: 'Público',
  PERSONAL: 'Personal',
  ADMIN: 'Administrador',
};
