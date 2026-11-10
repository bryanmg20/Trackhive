/**
 * Current version of the privacy notice accepted during public registration.
 *
 * When the notice text changes, bump this version and update the frontend
 * constant (`frontend/src/features/auth/register/privacy-policy.ts`). The
 * backend rejects registrations that accept an outdated version.
 */
export const CURRENT_PRIVACY_POLICY_VERSION = '1.0';
