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
