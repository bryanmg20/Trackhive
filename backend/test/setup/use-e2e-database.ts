import { resolveE2eDatabaseUrl } from './e2e-database-url';

// Runs in every test worker before its file (setupFiles). PrismaClient and
// ConfigModule read DATABASE_URL from process.env, and ConfigModule never
// overrides a variable that is already set, so every e2e uses the isolated
// database, never the one of the .env (HU-41)
process.env.DATABASE_URL = resolveE2eDatabaseUrl();
