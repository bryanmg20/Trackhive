export const ROUTES = {
  profile: '/mi-perfil',
  register: '/registro',
  login: '/login',
  newRequest: '/solicitudes/nueva',
  myRequests: '/mis-solicitudes',
  staffNewRequest: '/personal/solicitudes/nueva',
  materials: '/materiales',
  staffMaterials: '/personal/materiales',
  requests: '/solicitudes',
  requestDetail: '/solicitudes/:id',
  calendar: '/calendario',
  adminRoomCapacity: '/admin/capacidad-sala',
  staffUsers: '/admin/usuarios',
  adminEverythingSync: '/admin/sincronizacion',
  mostRequestedMaterials: '/reportes/material-mas-solicitado',
  attentionTimes: '/reportes/tiempos-de-atencion',
} as const;

export function requestDetailPath(id: string): string {
  return `/solicitudes/${encodeURIComponent(id)}`;
}
