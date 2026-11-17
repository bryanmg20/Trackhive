/**
 * URL of the PostgreSQL database of the e2e tests (D-21, HU-41).
 *
 * The e2e tests reset this database at the start of every run, so it must
 * never be the development or production one:
 * - E2E_DATABASE_URL, when it is set (the CI sets it), is used as it is.
 * - Otherwise the name of the database in DATABASE_URL gets the `_e2e`
 *   suffix: with the .env of the repo, `trackhive` becomes `trackhive_e2e`,
 *   in the same PostgreSQL of docker-compose.
 *
 * Either way, the name must end with `_e2e`; if not, the tests stop before
 * touching anything.
 */
export const E2E_DATABASE_SUFFIX = '_e2e';

export function resolveE2eDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.E2E_DATABASE_URL;
  const base = explicit ?? env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'Las pruebas e2e necesitan PostgreSQL: define E2E_DATABASE_URL o ' +
        'DATABASE_URL (en el .env de la raíz del repositorio).',
    );
  }

  const url = new URL(base);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name) {
    throw new Error(
      'La URL de la base de datos no tiene el nombre de la base.',
    );
  }

  if (!explicit && !name.endsWith(E2E_DATABASE_SUFFIX)) {
    url.pathname = `/${encodeURIComponent(name + E2E_DATABASE_SUFFIX)}`;
  }

  const finalName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!finalName.endsWith(E2E_DATABASE_SUFFIX)) {
    throw new Error(
      `La base de las pruebas e2e se llama "${finalName}" y no termina en ` +
        `"${E2E_DATABASE_SUFFIX}". Las pruebas la borran al empezar, así que ` +
        'no se usa una base que pueda ser la de desarrollo o la de producción.',
    );
  }
  return url.toString();
}
