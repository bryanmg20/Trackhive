import { authenticatedFetch } from '../auth/api/authenticated-fetch';
import { apiUrl } from '../auth/api/api-base-url';
import {
  networkRequestApiError,
  readRequestApiError,
} from '../requests/api/request-api-error';
import type { CharacterizationValues } from './characterization';

export interface MyProfile {
  firstName: string;
  lastName: string;
  email: string;
  municipality: string | null;
  ageRange: string | null;
  populationGroup: string | null;
}

export async function profileApi(
  values?: CharacterizationValues,
): Promise<MyProfile> {
  let response: Response;
  try {
    response = await authenticatedFetch(apiUrl('/api/v1/users/me/profile'), {
      method: values ? 'PATCH' : 'GET',
      headers: {
        Accept: 'application/json',
        ...(values ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(values
        ? {
            body: JSON.stringify({
              ...values,
              populationGroup: values.populationGroup || null,
            }),
          }
        : {}),
    });
  } catch {
    throw networkRequestApiError();
  }
  if (!response.ok) throw await readRequestApiError(response);
  return (await response.json()) as MyProfile;
}
