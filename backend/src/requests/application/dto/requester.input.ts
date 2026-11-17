/** The person a staff member registers a request for (HU-10). */
export interface RequesterInput {
  municipality?: string;
  ageRange?: string;
  populationGroup?: string | null;
  email: string;
  // A registered user, found with «buscar solicitante»
  userId?: string;
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
