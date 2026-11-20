import { REQUEST_STATUSES } from '../enums/request-status';
import { canResolveReferences } from './reference-resolution';

describe('reference resolution policy (HU-09.2)', () => {
  it('only lets the staff resolve references while RECIBIDA or EN_BUSQUEDA', () => {
    expect(REQUEST_STATUSES.filter(canResolveReferences)).toEqual([
      'RECIBIDA',
      'EN_BUSQUEDA',
    ]);
  });
});
