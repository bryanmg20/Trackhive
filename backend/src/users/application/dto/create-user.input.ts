/** The data of a new account, already validated by CreateUserDto (HU-01). */
export interface CreateUserInput {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  secondLastName?: string | null;
  email: string;
  password: string;
  acceptedPrivacy: boolean;
  privacyPolicyVersion: string;
}
