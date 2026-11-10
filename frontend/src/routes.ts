export const ROUTES = {
  register: '/registro',
  login: '/login',
  newRequest: '/solicitudes/nueva',
  staffNewRequest: '/personal/solicitudes/nueva',
  materials: '/materiales',
  staffMaterials: '/personal/materiales',
  requests: '/solicitudes',
  requestDetail: '/solicitudes/:id',
} as const;

export function requestDetailPath(id: string): string {
  return `/solicitudes/${encodeURIComponent(id)}`;
}
