/**
 * Base para los errores de dominio y aplicación.
 *
 * El código es estable y lo usa el filtro global para traducir el error a
 * HTTP, de modo que el frontend pueda reaccionar por tipo sin depender del
 * texto del mensaje.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
