import { InvalidNameError } from './errors/invalid-name.error';

/**
 * A person's name is stored in four fields, the same in users and
 * requesters (issue #96). First name and last name are required; middle
 * name and second last name are optional.
 */
export const NAME_MAX_LENGTH = 40;

export type NameField =
  'firstName' | 'middleName' | 'lastName' | 'secondLastName';

/** Trims a required name field; it cannot be blank or too long. */
export function requiredName(
  value: string | null | undefined,
  field: NameField,
): string {
  const name = value?.trim() ?? '';
  if (!name) {
    throw new InvalidNameError(field, 'REQUIRED');
  }
  if (name.length > NAME_MAX_LENGTH) {
    throw new InvalidNameError(field, 'TOO_LONG');
  }
  return name;
}

/** Trims an optional name field; blank means "not given" and becomes null. */
export function optionalName(
  value: string | null | undefined,
  field: NameField,
): string | null {
  const name = value?.trim() ?? '';
  if (!name) {
    return null;
  }
  if (name.length > NAME_MAX_LENGTH) {
    throw new InvalidNameError(field, 'TOO_LONG');
  }
  return name;
}
