import { InvalidEmailError } from '../errors/invalid-email.error';
import { InvalidFullNameError } from '../errors/invalid-full-name.error';
import { InvalidPasswordHashError } from '../errors/invalid-password-hash.error';
import { InvalidRoleError } from '../errors/invalid-role.error';
import { isUserRole, UserRole } from '../user-role';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME_MAX_LENGTH = 120;
const EMAIL_MAX_LENGTH = 160;
const PASSWORD_HASH_MAX_LENGTH = 255;

export interface UserProps {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
}

export class User {
  public readonly id: string;
  public readonly fullName: string;
  public readonly email: string;
  public readonly passwordHash: string;
  public readonly role: UserRole;
  public readonly active: boolean;

  constructor(props: UserProps) {
    const fullName = props.fullName?.trim() ?? '';
    const email = props.email?.trim().toLowerCase() ?? '';

    // Business rules: a user cannot exist with invalid account data
    if (!fullName || fullName.length > FULL_NAME_MAX_LENGTH) {
      throw new InvalidFullNameError();
    }
    if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email)) {
      throw new InvalidEmailError();
    }
    if (
      !props.passwordHash ||
      props.passwordHash.trim().length === 0 ||
      props.passwordHash.length > PASSWORD_HASH_MAX_LENGTH
    ) {
      throw new InvalidPasswordHashError();
    }
    if (!isUserRole(props.role)) {
      throw new InvalidRoleError();
    }

    this.id = props.id;
    this.fullName = fullName;
    this.email = email;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.active = props.active;
  }
}
