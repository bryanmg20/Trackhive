/**
 * Origin for the API when the frontend and the backend are served from
 * different hosts. With Docker Compose (and with `pnpm dev`) it is empty and
 * the browser calls `/api/...`, which nginx or the Vite proxy forwards.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(
  /\/+$/,
  '',
);

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
