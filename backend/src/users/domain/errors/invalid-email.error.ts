export class InvalidEmailError extends Error {
  constructor() {
    super('El correo no tiene un formato válido');
  }
}
