/**
 * Page sizes of the listings. They live outside the request DTOs so the use
 * cases can read the defaults without depending on a DTO of the HTTP request
 * (#144).
 */

/** Material search (HU-07). */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Staff and «Mis solicitudes» listings (HU-11, HU-12). */
export const DEFAULT_REQUEST_PAGE_LIMIT = 20;
export const MAX_REQUEST_PAGE_LIMIT = 100;

/** Appointments calendar (HU-19). */
export const DEFAULT_APPOINTMENT_PAGE_LIMIT = 20;
export const MAX_APPOINTMENT_PAGE_LIMIT = 100;

/** Staff accounts listing (HU-05). */
export const DEFAULT_USER_PAGE_LIMIT = 20;
export const MAX_USER_PAGE_LIMIT = 100;
