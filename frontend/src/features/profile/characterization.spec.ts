import { describe, expect, it } from 'vitest';
import {
  AGE_RANGES,
  POPULATION_GROUPS,
  characterizationSchema,
} from './characterization';

describe('Characterization form', () => {
  it.each(AGE_RANGES)(
    'accepts range %s with no population group',
    (ageRange) => {
      expect(
        characterizationSchema.safeParse({
          municipality: 'Barranquilla',
          ageRange,
        }).success,
      ).toBe(true);
    },
  );
  it.each(POPULATION_GROUPS)(
    'accepts attendance-form option $label',
    ({ value }) => {
      expect(
        characterizationSchema.safeParse({
          municipality: 'Soledad',
          ageRange: '29-59',
          populationGroup: value,
        }).success,
      ).toBe(true);
    },
  );
  it.each([
    { municipality: '', ageRange: '18-28' },
    { municipality: 'Soledad', ageRange: '27' },
    { municipality: 'Soledad', ageRange: '18-28', populationGroup: 'UNKNOWN' },
  ])('rejects invalid values %j', (values) => {
    expect(characterizationSchema.safeParse(values).success).toBe(false);
  });
});
