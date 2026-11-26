import { authenticatedFetch } from '../auth/api/authenticated-fetch';
import { apiUrl } from '../auth/api/api-base-url';
import { clearSession } from '../auth/session';
import {
  networkRequestApiError,
  readRequestApiError,
} from '../requests/api/request-api-error';
export async function deleteMyAccount(): Promise<void> {
  let response: Response;
  try {
    response = await authenticatedFetch(apiUrl('/api/v1/users/me/profile'), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ confirmation: true }),
    });
  } catch {
    throw networkRequestApiError();
  }
  if (!response.ok) throw await readRequestApiError(response);
  clearSession();
}
