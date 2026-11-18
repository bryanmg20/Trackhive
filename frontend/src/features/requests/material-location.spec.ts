import { describe, expect, it } from 'vitest';
import { formatMaterialLocation } from './material-location';

describe('formatMaterialLocation', () => {
  it('joins depot, shelf and box', () => {
    expect(
      formatMaterialLocation({ depot: 'D-01', shelf: 'E-01', box: 'C-001' }),
    ).toBe('Ubicación: D-01 · E-01 · C-001');
  });

  it('says it is not registered when the material has no location', () => {
    expect(formatMaterialLocation(null)).toBe('Ubicación: sin registrar');
  });
});
