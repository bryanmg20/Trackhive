import { User } from './user.entity';
import { InvalidEmailError } from '../errors/invalid-email.error';

describe('User', () => {
  it('creates a user with a valid email', () => {
    const user = new User('1', 'ana@mail.com');

    expect(user.email).toBe('ana@mail.com');
  });

  it('throws InvalidEmailError when the email is invalid', () => {
    expect(() => new User('1', 'not-an-email')).toThrow(InvalidEmailError);
  });
});
