export const REQUEST_STATUSES = [
  'RECIBIDA',
  'EN_BUSQUEDA',
  'DISPONIBLE',
  'AGENDADA',
  'ATENDIDA',
  'CERRADA',
  'RECHAZADA',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  RECIBIDA: 'Recibida',
  EN_BUSQUEDA: 'En búsqueda',
  DISPONIBLE: 'Disponible',
  AGENDADA: 'Agendada',
  ATENDIDA: 'Atendida',
  CERRADA: 'Cerrada',
  RECHAZADA: 'Rechazada',
};

export function isRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}

/**
 * Statuses the staff can choose in the «cambiar estado» action (HU-15).
 * RECIBIDA is only the initial status, RECHAZADA needs a reason, so it
 * goes through reject() (HU-16), and AGENDADA is only reached by scheduling
 * an appointment (HU-18).
 */
export const CHANGEABLE_STATUSES = [
  'EN_BUSQUEDA',
  'DISPONIBLE',
  'ATENDIDA',
  'CERRADA',
] as const satisfies readonly RequestStatus[];

export type ChangeableStatus = (typeof CHANGEABLE_STATUSES)[number];

export function isChangeableStatus(value: string): value is ChangeableStatus {
  return (CHANGEABLE_STATUSES as readonly string[]).includes(value);
}
