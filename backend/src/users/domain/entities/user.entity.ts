import { InvalidEmailError } from '../errors/invalid-email.error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
  ) {
    // Regla de negocio: no existe un usuario con correo inválido
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new InvalidEmailError();
    }
  }
}
