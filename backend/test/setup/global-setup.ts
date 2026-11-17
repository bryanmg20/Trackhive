import { execFileSync } from 'child_process';
import { join } from 'path';
import { resolveE2eDatabaseUrl } from './e2e-database-url';

/**
 * Runs once before the e2e tests (HU-41): drops the e2e database and applies
 * the same migrations as production (`prisma migrate reset`), so every run
 * starts empty and with the real schema: the CHECKs, the insert-only trigger
 * of the history (D-08), the unique index of the agenda (D-09) and pg_trgm
 * (D-16). Prisma creates the database if it does not exist yet.
 */
export default function globalSetup(): void {
  const databaseUrl = resolveE2eDatabaseUrl();
  const backendDir = join(__dirname, '..', '..');
  const prisma = join(
    backendDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
  );

  execFileSync(
    prisma,
    ['migrate', 'reset', '--force', '--skip-seed', '--skip-generate'],
    {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    },
  );
}
