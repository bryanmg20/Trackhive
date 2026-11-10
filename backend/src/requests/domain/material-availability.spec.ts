import {
  findMaterialConflicts,
  type MaterialAvailability,
} from './material-availability';

const material = (
  overrides: Partial<MaterialAvailability> = {},
): MaterialAvailability => ({
  catalogCode: 'AHB-001',
  title: 'Actas de 1890',
  status: 'DISPONIBLE',
  bookedBy: null,
  ...overrides,
});

describe('findMaterialConflicts (HU-20)', () => {
  it('finds no conflict when every material is free that day', () => {
    expect(findMaterialConflicts([material()])).toEqual([]);
  });

  it('lets a material EN_USO be scheduled: it only applies to its day in the room (HU-72)', () => {
    expect(findMaterialConflicts([material({ status: 'EN_USO' })])).toEqual([]);
  });

  it('finds the double booking of a material with the other request', () => {
    expect(
      findMaterialConflicts([material({ bookedBy: 'SOL-2026-00012' })]),
    ).toEqual([
      {
        reason: 'BOOKED',
        catalogCode: 'AHB-001',
        title: 'Actas de 1890',
        trackingCode: 'SOL-2026-00012',
      },
    ]);
  });

  it.each(['EN_RESTAURACION', 'NO_CONSULTABLE'] as const)(
    'finds a material %s',
    (status) => {
      expect(findMaterialConflicts([material({ status })])).toEqual([
        {
          reason: 'UNAVAILABLE',
          catalogCode: 'AHB-001',
          title: 'Actas de 1890',
          status,
        },
      ]);
    },
  );

  it('returns every conflict of every material, in order', () => {
    const conflicts = findMaterialConflicts([
      material({ bookedBy: 'SOL-2026-00012' }),
      material({ catalogCode: 'AHB-002', title: 'El Heraldo, 1935' }),
      material({
        catalogCode: 'AHB-003',
        title: 'Fotografías del puerto',
        status: 'NO_CONSULTABLE',
        bookedBy: 'SOL-2026-00013',
      }),
    ]);

    expect(
      conflicts.map(({ catalogCode, reason }) => `${catalogCode} ${reason}`),
    ).toEqual(['AHB-001 BOOKED', 'AHB-003 BOOKED', 'AHB-003 UNAVAILABLE']);
  });
});
