import { blocksScheduling } from './material-availability';

describe('blocksScheduling', () => {
  it('blocks a material that is being restored', () => {
    expect(blocksScheduling('EN_RESTAURACION')).toBe(true);
  });

  it('blocks a material that is not consultable', () => {
    expect(blocksScheduling('NO_CONSULTABLE')).toBe(true);
  });

  it('does not block an in-use material: it only applies to the day in the room (HU-72)', () => {
    expect(blocksScheduling('EN_USO')).toBe(false);
  });

  it('does not block an available material', () => {
    expect(blocksScheduling('DISPONIBLE')).toBe(false);
  });
});
