import { InvalidEmailError } from '../errors/invalid-email.error';
import { InvalidPasswordHashError } from '../errors/invalid-password-hash.error';
import { InvalidPrivacyConsentError } from '../errors/invalid-privacy-consent.error';
import { InvalidRoleError } from '../errors/invalid-role.error';
import { optionalName, requiredName } from '../person-name';
import { isUserRole, UserRole } from '../user-role';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 160;
const PASSWORD_HASH_MAX_LENGTH = 255;

export interface UserProps {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  secondLastName?: string | null;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  // Public registrations always set both; seeded/admin accounts may have none
  privacyPolicyAcceptedAt?: Date | null;
  privacyPolicyVersion?: string | null;
}

export class User {
  public readonly id: string;
  public readonly firstName: string;
  public readonly middleName: string | null;
  public readonly lastName: string;
  public readonly secondLastName: string | null;
  public readonly email: string;
  public readonly passwordHash: string;
  public readonly role: UserRole;
  public readonly active: boolean;
  public readonly privacyPolicyAcceptedAt: Date | null;
  public readonly privacyPolicyVersion: string | null;

  constructor(props: UserProps) {
    // Business rules: a user cannot exist with invalid account data
    const firstName = requiredName(props.firstName, 'firstName');
    const middleName = optionalName(props.middleName, 'middleName');
    const lastName = requiredName(props.lastName, 'lastName');
    const secondLastName = optionalName(props.secondLastName, 'secondLastName');
    const email = props.email?.trim().toLowerCase() ?? '';

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

    const privacyPolicyAcceptedAt = props.privacyPolicyAcceptedAt ?? null;
    const privacyPolicyVersion = props.privacyPolicyVersion?.trim() || null;
    if (
      (privacyPolicyAcceptedAt === null) !==
      (privacyPolicyVersion === null)
    ) {
      throw new InvalidPrivacyConsentError();
    }

    this.id = props.id;
    this.firstName = firstName;
    this.middleName = middleName;
    this.lastName = lastName;
    this.secondLastName = secondLastName;
    this.email = email;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.active = props.active;
    this.privacyPolicyAcceptedAt = privacyPolicyAcceptedAt;
    this.privacyPolicyVersion = privacyPolicyVersion;
  }
}
