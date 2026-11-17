import type { CharacterizationData } from '../../domain/value-objects/characterization';

export interface UpdateMyProfileInput extends CharacterizationData {
  userId: string;
}
