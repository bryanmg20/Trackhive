import { incompleteRunReason } from './sync-completeness';

describe('incompleteRunReason (HU-137)', () => {
  it('una corrida con exactamente las páginas 1..N está completa', () => {
    expect(incompleteRunReason(3, [3, 1, 2])).toBeNull();
  });

  it('dice qué páginas faltan', () => {
    expect(incompleteRunReason(4, [1, 3])).toBe(
      'El agente cerró la corrida como completa con 4 páginas, pero faltan las páginas 2, 4',
    );
  });

  it('dice qué página sobra por encima de las que contó el agente', () => {
    expect(incompleteRunReason(2, [1, 2, 3])).toBe(
      'El agente cerró la corrida como completa con 2 páginas, pero sobra la página 3',
    );
  });

  it('puede faltar una y sobrar otras a la vez', () => {
    expect(incompleteRunReason(2, [1, 3, 4])).toBe(
      'El agente cerró la corrida como completa con 2 páginas, pero falta la página 2 y sobran las páginas 3, 4',
    );
  });

  it('sin ninguna página, faltan todas', () => {
    expect(incompleteRunReason(1, [])).toContain('falta la página 1');
  });

  it('con muchas páginas perdidas solo nombra las primeras', () => {
    expect(incompleteRunReason(25, [1])).toContain(
      'faltan las páginas 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 y 14 más',
    );
  });
});
