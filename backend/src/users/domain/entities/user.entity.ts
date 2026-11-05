import { InvalidEmailError } from '../errors/invalid-email.error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
  ) {
    // Business rule: a user cannot exist with an invalid email
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new InvalidEmailError();
    }
  }
}
