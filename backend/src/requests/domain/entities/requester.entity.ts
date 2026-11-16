import type { User } from '../../../users/domain/entities/user.entity';
import { RequesterNameRequiredError } from '../errors/requester-name-required.error';

// The consent the requester gives when they register (HU-31). The visitors
// the staff registers accept it in person, so it is recorded the same way
const PRIVACY_POLICY_VERSION = '1.0';

export interface RequesterProps {
  id: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  // NULL when the requester only left a phone
  email: string | null;
  phone: string | null;
  requesterType: string;
  institution: string | null;
  documentType: string | null;
  documentNumber: string | null;
  acceptsDataProcessing: boolean;
  consentedAt: Date;
  privacyPolicyVersion: string;
}

/** The contact data of a visitor the staff registers (HU-10). */
export interface RequesterContactData {
  email: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  secondLastName?: string | null;
  phone?: string | null;
  requesterType?: string;
  institution?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
}

/** Who a request is for: a user account or a visitor without one. */
export class Requester {
  constructor(public readonly props: Readonly<RequesterProps>) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string | null {
    return this.props.userId;
  }

  /** The requester of a user account, with the same four names (issue #96). */
  static fromUser(
    user: Pick<
      User,
      | 'id'
      | 'firstName'
      | 'middleName'
      | 'lastName'
      | 'secondLastName'
      | 'email'
    >,
    id: string,
    now: Date = new Date(),
  ): Requester {
    return new Requester({
      id,
      userId: user.id,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      secondLastName: user.secondLastName,
      email: user.email.trim().toLowerCase(),
      phone: null,
      requesterType: 'INVESTIGADOR',
      institution: null,
      documentType: null,
      documentNumber: null,
      acceptsDataProcessing: true,
      consentedAt: now,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    });
  }

  /** A visitor without an account: the first and last name are required. */
  static fromContact(
    contact: RequesterContactData,
    id: string,
    now: Date = new Date(),
  ): Requester {
    const firstName = contact.firstName?.trim();
    const lastName = contact.lastName?.trim();
    if (!firstName || !lastName) {
      throw new RequesterNameRequiredError();
    }
    return new Requester({
      id,
      userId: null,
      firstName,
      middleName: contact.middleName?.trim() || null,
      lastName,
      secondLastName: contact.secondLastName?.trim() || null,
      email: contact.email.trim().toLowerCase(),
      phone: contact.phone?.trim() || null,
      requesterType: contact.requesterType ?? 'CIUDADANO',
      institution: contact.institution?.trim() || null,
      documentType: contact.documentType ?? null,
      documentNumber: contact.documentNumber?.trim() || null,
      acceptsDataProcessing: true,
      consentedAt: now,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    });
  }
}
