import { AGE_RANGES, type AgeRange } from '../enums/age-range';
import { InvalidCharacterizationError } from '../errors/invalid-characterization.error';
import {
  POPULATION_GROUPS,
  type PopulationGroup,
} from '../enums/population-group';

export interface CharacterizationData {
  municipality: string;
  ageRange: string;
  populationGroup?: string | null;
}

export class Characterization {
  readonly municipality: string;
  readonly ageRange: AgeRange;
  readonly populationGroup: string | null;

  constructor(data: CharacterizationData) {
    const municipality = data.municipality?.trim();
    const populationGroup = data.populationGroup?.trim() || null;
    if (
      !municipality ||
      municipality.length > 120 ||
      !AGE_RANGES.includes(data.ageRange as AgeRange) ||
      (populationGroup !== null &&
        !POPULATION_GROUPS.includes(populationGroup as PopulationGroup))
    ) {
      throw new InvalidCharacterizationError();
    }
    this.municipality = municipality;
    this.ageRange = data.ageRange as AgeRange;
    this.populationGroup = populationGroup;
  }
}
