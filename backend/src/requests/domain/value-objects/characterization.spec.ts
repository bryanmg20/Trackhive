import { AGE_RANGES } from '../enums/age-range';
import { POPULATION_GROUPS } from '../enums/population-group';
import { InvalidCharacterizationError } from '../errors/invalid-characterization.error';
import { Characterization } from './characterization';

describe('Characterization', () => {
  it.each(AGE_RANGES)(
    'accepts age range %s without an exact birth date',
    (ageRange) => {
      expect(
        new Characterization({ municipality: ' Barranquilla ', ageRange }),
      ).toMatchObject({
        municipality: 'Barranquilla',
        ageRange,
        populationGroup: null,
      });
    },
  );

  it.each(POPULATION_GROUPS)(
    'accepts attendance-form group %s',
    (populationGroup) => {
      expect(
        new Characterization({
          municipality: 'Soledad',
          ageRange: '60+',
          populationGroup,
        }).populationGroup,
      ).toBe(populationGroup);
    },
  );

  it.each([
    { municipality: '', ageRange: '18-28' },
    { municipality: '   ', ageRange: '18-28' },
    { municipality: 'x'.repeat(121), ageRange: '18-28' },
    { municipality: 'Soledad', ageRange: '20' },
    { municipality: 'Soledad', ageRange: '18-28', populationGroup: 'UNKNOWN' },
  ])('rejects invalid characterization %j', (input) => {
    expect(() => new Characterization(input)).toThrow(
      InvalidCharacterizationError,
    );
  });
});
