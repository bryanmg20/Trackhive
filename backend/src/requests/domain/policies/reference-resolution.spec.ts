import { REQUEST_STATUSES } from '../enums/request-status';
import {
  canResolveReferences,
  referenceDisplayStatus,
} from './reference-resolution';

describe('reference resolution policy (HU-09.2)', () => {
  it('only lets the staff resolve references while RECIBIDA or EN_BUSQUEDA', () => {
    expect(REQUEST_STATUSES.filter(canResolveReferences)).toEqual([
      'RECIBIDA',
      'EN_BUSQUEDA',
    ]);
  });
});

describe('referenceDisplayStatus (HU-09.2)', () => {
  it.each([
    ['PENDIENTE', 'RECIBIDA', 'PENDIENTE'],
    ['PENDIENTE', 'EN_BUSQUEDA', 'PENDIENTE'],
    ['PENDIENTE', 'DISPONIBLE', 'SIN_MATERIAL'],
    ['PENDIENTE', 'RECHAZADA', 'SIN_MATERIAL'],
    ['RESUELTA', 'EN_BUSQUEDA', 'RESUELTA'],
    ['RESUELTA', 'CERRADA', 'RESUELTA'],
  ] as const)(
    'shows a %s reference of a %s request as %s',
    (status, requestStatus, expected) => {
      expect(referenceDisplayStatus(status, requestStatus)).toBe(expected);
    },
  );
});
