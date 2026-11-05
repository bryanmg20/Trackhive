/**
 * Base class for domain and application errors.
 *
 * The code is stable and the global filter uses it to translate the error
 * into HTTP, so the frontend can react by type without depending on the
 * message text.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
