import type { EverythingSyncConfig } from '../../application/dto/everything-sync-config';

// A run without pages for longer has expired (HU-137)
export const DEFAULT_RUN_TIMEOUT_MINUTES = 30;
// Long enough not to be guessed: `openssl rand -hex 32` gives 64 characters
export const MIN_AGENT_TOKEN_LENGTH = 32;
// The token of .env.example and agent/agente.example.toml: public, so that
// the agent works in development without generating one
export const DEVELOPMENT_AGENT_TOKEN =
  'trackhive-dev-token-solo-desarrollo-no-usar-en-produccion';

/**
 * Reads EVERYTHING_AGENT_TOKEN and EVERYTHING_RUN_TIMEOUT_MINUTES when the
 * backend starts (D-23). Without a token the integration is disabled; a
 * short token, the public one of development in production (RUN_SEED=false,
 * as for ADMIN_PASSWORD) or a wrong timeout stops the backend with the reason.
 */
export function loadEverythingSyncConfig(
  read: (key: string) => string | undefined,
): EverythingSyncConfig {
  const token = read('EVERYTHING_AGENT_TOKEN')?.trim() ?? '';
  if (token !== '' && token.length < MIN_AGENT_TOKEN_LENGTH) {
    throw new Error(
      `EVERYTHING_AGENT_TOKEN debe tener al menos ${MIN_AGENT_TOKEN_LENGTH} caracteres ` +
        '(genera uno con `openssl rand -hex 32`), o déjalo vacío para desactivar la sincronización con Everything',
    );
  }
  if (token === DEVELOPMENT_AGENT_TOKEN && read('RUN_SEED') !== 'true') {
    throw new Error(
      'EVERYTHING_AGENT_TOKEN es el de .env.example, que es público: con RUN_SEED=false ' +
        'genera uno propio (`openssl rand -hex 32`) y ponlo también en el agente, ' +
        'o déjalo vacío para desactivar la sincronización con Everything',
    );
  }

  const rawTimeout = read('EVERYTHING_RUN_TIMEOUT_MINUTES')?.trim() ?? '';
  const timeout =
    rawTimeout === '' ? DEFAULT_RUN_TIMEOUT_MINUTES : Number(rawTimeout);
  if (!Number.isSafeInteger(timeout) || timeout < 1) {
    throw new Error(
      `EVERYTHING_RUN_TIMEOUT_MINUTES debe ser un número entero de minutos mayor que 0 (es «${rawTimeout}»)`,
    );
  }

  return {
    agentToken: token === '' ? null : token,
    runTimeoutMinutes: timeout,
  };
}
