/** The four names of a person (issue #96). */
export interface PersonNameParts {
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
}

/** The four names joined as the screens show them, skipping the empty ones. */
export class PersonNameMapper {
  static fullName(person: PersonNameParts): string {
    return [
      person.firstName,
      person.middleName,
      person.lastName,
      person.secondLastName,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
