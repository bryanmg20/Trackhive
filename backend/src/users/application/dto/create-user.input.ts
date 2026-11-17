/** The data of a new account, already validated by CreateUserDto (HU-01). */
import type { CharacterizationData } from '../../../requests/domain/value-objects/characterization';

export interface CreateUserInput extends CharacterizationData {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  secondLastName?: string | null;
  email: string;
  password: string;
  acceptedPrivacy: boolean;
  privacyPolicyVersion: string;
}
