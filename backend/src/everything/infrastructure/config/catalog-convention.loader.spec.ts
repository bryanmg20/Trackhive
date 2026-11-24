import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { InvalidCatalogConventionError } from '../../domain/errors/invalid-catalog-convention.error';
import {
  CATALOG_CONVENTION_FILE,
  loadCatalogConvention,
} from './catalog-convention.loader';

describe('loadCatalogConvention', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'convencion-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('carga backend/config/catalog-convention.json con sus tres fondos', () => {
    const convention = loadCatalogConvention();

    expect(CATALOG_CONVENTION_FILE).toMatch(
      /backend[\\/]config[\\/]catalog-convention\.json$/,
    );
    expect(convention.funds.map((fund) => fund.prefix)).toEqual([
      'NOT',
      'PER',
      'DOC',
    ]);
  });

  it('un archivo que no es JSON detiene el arranque con el motivo', () => {
    const file = join(dir, 'roto.json');
    writeFileSync(file, '{ "funds": [', 'utf8');

    expect(() => loadCatalogConvention(file)).toThrow(
      InvalidCatalogConventionError,
    );
  });

  it('un archivo que no existe detiene el arranque', () => {
    expect(() => loadCatalogConvention(join(dir, 'no-existe.json'))).toThrow(
      /no se pudo leer/,
    );
  });

  it('una convención mal escrita detiene el arranque', () => {
    const file = join(dir, 'sin-fondos.json');
    writeFileSync(
      file,
      JSON.stringify({
        base: 'C:\\x',
        defaultMaterialType: 'DOCUMENTO',
        funds: [],
      }),
      'utf8',
    );

    expect(() => loadCatalogConvention(file)).toThrow(/funds está vacía/);
  });
});
