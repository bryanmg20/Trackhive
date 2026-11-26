import { CannotChangeOwnAccessError } from '../errors/cannot-change-own-access.error';
import { InvalidEmailError } from '../errors/invalid-email.error';
import { InvalidPasswordHashError } from '../errors/invalid-password-hash.error';
import { InvalidPrivacyConsentError } from '../errors/invalid-privacy-consent.error';
import { InvalidRoleError } from '../errors/invalid-role.error';
import { InvalidStaffRoleError } from '../errors/invalid-staff-role.error';
import { optionalName, requiredName } from '../value-objects/person-name';
import { isStaffRole, isUserRole, UserRole } from '../enums/user-role';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 160;
const PASSWORD_HASH_MAX_LENGTH = 255;

/** A field that was not sent (undefined) keeps its current value. */
function changedOrCurrent<T>(value: T | undefined, current: T): T {
  return value === undefined ? current : value;
}

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

/**
 * A new staff account that an administrator creates (HU-05). There is no
 * role: the administrator only creates PERSONAL accounts.
 */
export interface NewStaffUserProps {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  secondLastName?: string | null;
  email: string;
  passwordHash: string;
}

/** The initial administrator, created from the .env (HU-42). */
export interface NewInitialAdminProps {
  id: string;
  email: string;
  passwordHash: string;
}

/**
 * What an administrator can change in a staff account (HU-05). A field left
 * undefined keeps its value; null clears an optional name. The role is not
 * here: no account can be changed from PERSONAL to ADMIN.
 */
export interface StaffAccountChanges {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  secondLastName?: string | null;
  email?: string;
  active?: boolean;
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

  /**
   * A staff account created by an administrator (HU-05). It is always
   * PERSONAL: the administrator does not create ADMIN accounts. It starts
   * active, so it can sign in right away, and records no privacy consent:
   * that belongs to public registrations (D-19).
   */
  static createStaff(props: NewStaffUserProps): User {
    return new User({
      ...props,
      role: 'PERSONAL',
      active: true,
      privacyPolicyAcceptedAt: null,
      privacyPolicyVersion: null,
    });
  }

  /**
   * The first ADMIN account, created when the app starts from ADMIN_EMAIL and
   * ADMIN_PASSWORD (HU-42). It is the only way an ADMIN is created. The .env
   * gives no names, so it gets generic ones. It starts active and records no
   * privacy consent, like every staff account (D-19).
   */
  static createInitialAdmin(props: NewInitialAdminProps): User {
    return new User({
      ...props,
      firstName: 'Administrador',
      middleName: null,
      lastName: 'Trackhive',
      secondLastName: null,
      role: 'ADMIN',
      active: true,
      privacyPolicyAcceptedAt: null,
      privacyPolicyVersion: null,
    });
  }

  /** PERSONAL and ADMIN accounts; PUBLICO accounts are not staff. */
  isStaff(): boolean {
    return isStaffRole(this.role);
  }

  /**
   * Returns a copy with the changes an administrator makes to a staff
   * account (HU-05): names, email and whether it is active. The role never
   * changes. `changedBy` is the administrator: they cannot deactivate their
   * own account.
   */
  updateStaffAccount(changes: StaffAccountChanges, changedBy: string): User {
    const active = changedOrCurrent(changes.active, this.active);

    // A public account is not managed by the administrator
    if (!this.isStaff()) {
      throw new InvalidStaffRoleError();
    }
    if (changedBy === this.id && !active) {
      throw new CannotChangeOwnAccessError();
    }

    // The constructor validates the new names and email
    return new User({
      ...this,
      firstName: changedOrCurrent(changes.firstName, this.firstName),
      middleName: changedOrCurrent(changes.middleName, this.middleName),
      lastName: changedOrCurrent(changes.lastName, this.lastName),
      secondLastName: changedOrCurrent(
        changes.secondLastName,
        this.secondLastName,
      ),
      email: changedOrCurrent(changes.email, this.email),
      active,
    });
  }
}
