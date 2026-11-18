/**
 * A new staff account, already validated by CreateStaffUserDto (HU-05). It
 * has no role: the account is always PERSONAL.
 */
export interface CreateStaffUserInput {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  secondLastName?: string | null;
  email: string;
  // Initial password set by the administrator; only its hash is stored
  password: string;
}
