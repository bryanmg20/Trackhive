import { readFileSync } from 'fs';
import { join } from 'path';
import type { CatalogConvention } from '../../application/dto/catalog-convention';
import { CatalogConventionMapper } from '../../application/mappers/catalog-convention.mapper';
import { InvalidCatalogConventionError } from '../../domain/errors/invalid-catalog-convention.error';

/**
 * backend/config/catalog-convention.json (HU-136). This file is at the same
 * depth under src/ and under dist/, so the path works with ts-jest, with
 * `pnpm start:dev` and in the Docker image (/app/config).
 */
export const CATALOG_CONVENTION_FILE = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'config',
  'catalog-convention.json',
);

/**
 * Reads and checks the folder convention when the backend starts: a wrong
 * file stops it with InvalidCatalogConventionError instead of failing in the
 * middle of a sync.
 */
export function loadCatalogConvention(
  file: string = CATALOG_CONVENTION_FILE,
): CatalogConvention {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new InvalidCatalogConventionError(
      `no se pudo leer ${file}: ${reason}`,
    );
  }
  return CatalogConventionMapper.fromJson(json);
}
