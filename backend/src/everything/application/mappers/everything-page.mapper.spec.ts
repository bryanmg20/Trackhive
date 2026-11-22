import { readFileSync } from 'fs';
import { join } from 'path';
import { InvalidEverythingPageError } from '../../domain/errors/invalid-everything-page.error';
import { EverythingPageMapper } from './everything-page.mapper';

// Real answers of Everything and the manifest of the simulated tree (HU-133)
const DEV = join(__dirname, '../../../../../dev');
const NOTARIAS_ROOT =
  'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Notarías\\Notarías';

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(join(DEV, file), 'utf8'));
const fixture = (id: string): unknown =>
  readJson(join('fixtures', `everything_${id}.json`));

/** A valid page of one folder, to break one field at a time. */
const page = (result: Record<string, unknown> = {}): unknown => ({
  totalResults: 1,
  results: [
    {
      type: 'folder',
      name: '1ra-1931 - Esc 0001-0109 - Ene',
      path: 'C:\\docs\\1931',
      size: '',
      date_modified: '134396687063866479',
      ...result,
    },
  ],
});

const reasonOf = (input: unknown): string => {
  try {
    EverythingPageMapper.toDocumentRecords(input);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidEverythingPageError);
    expect((error as InvalidEverythingPageError).code).toBe(
      'INVALID_EVERYTHING_PAGE',
    );
    return (error as InvalidEverythingPageError).reason;
  }
  throw new Error('No lanzó InvalidEverythingPageError');
};

describe('EverythingPageMapper', () => {
  describe('con las respuestas reales de Everything (fixtures de HU-133)', () => {
    it('convierte la primera página de carpetas de notarías', () => {
      const records = EverythingPageMapper.toDocumentRecords(
        fixture('carpetas_notarias_p1'),
      );

      expect(records).toHaveLength(50);
      expect(records[0]).toEqual({
        name: '1080',
        parentPath: `${NOTARIAS_ROOT}\\1ra - Notaria Primera de Barranquilla - 1815 a 1979`,
        fullPath: `${NOTARIAS_ROOT}\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1080`,
        kind: 'folder',
        // 134396687063866479 in FILETIME (100 ns since 1601)
        modifiedAt: new Date('2026-11-20T17:18:26.386Z'),
      });
      // A folder has no size: the key is not there
      expect(records.every((record) => !('size' in record))).toBe(true);
    });

    it('las tres páginas traen totalResults carpetas distintas, con todas las hojas del manifiesto', () => {
      const pages = ['p1', 'p2', 'p3'].map((id) =>
        EverythingPageMapper.toDocumentRecords(
          fixture(`carpetas_notarias_${id}`),
        ),
      );
      const fullPaths = new Set(pages.flat().map((r) => r.fullPath));

      // The last page brings less than count
      expect(pages.map((records) => records.length)).toEqual([50, 50, 24]);
      expect(fullPaths.size).toBe(124);

      const manifest = readJson('manifiesto.json') as {
        windowsRoot: string;
        leaves: { path: string }[];
      };
      const notariasLeaves = manifest.leaves
        .map((leaf) => `${manifest.windowsRoot}\\${leaf.path}`)
        .filter((path) => path.startsWith(`${NOTARIAS_ROOT}\\`));
      expect(notariasLeaves.length).toBeGreaterThan(0);
      expect(notariasLeaves.filter((path) => !fullPaths.has(path))).toEqual([]);
    });

    it('convierte el tamaño de los archivos de texto a número', () => {
      const records = EverythingPageMapper.toDocumentRecords(
        fixture('archivos_de_una_hoja'),
      );

      expect(records).toHaveLength(3);
      expect(records[0]).toMatchObject({
        name: '001 - 1ra - 1931 - Esc 0001.jpg',
        kind: 'file',
        size: 0,
      });
      expect(records[0].fullPath).toBe(
        `${records[0].parentPath}\\001 - 1ra - 1931 - Esc 0001.jpg`,
      );
    });

    it('la raíz del índice llega con la ruta como nombre y no se une con \\', () => {
      const [root] = EverythingPageMapper.toDocumentRecords(
        fixture('raiz_del_indice'),
      );

      expect(root).toMatchObject({
        name: 'C:\\trackhive\\docs_simulados',
        parentPath: '',
        fullPath: 'C:\\trackhive\\docs_simulados',
        kind: 'folder',
      });
    });

    it('una búsqueda sin resultados da una lista vacía', () => {
      expect(
        EverythingPageMapper.toDocumentRecords(fixture('sin_resultados')),
      ).toEqual([]);
    });

    it('un offset fuera de rango da una lista vacía', () => {
      expect(
        EverythingPageMapper.toDocumentRecords(
          fixture('offset_fuera_de_rango'),
        ),
      ).toEqual([]);
    });

    it('rechaza una página sin las columnas que pide la sincronización', () => {
      // file: without columns brings only type and name
      expect(reasonOf(fixture('solo_archivos'))).toBe(
        'results[0]: path no es un texto',
      );
    });
  });

  describe('la ruta completa', () => {
    it('no repite la barra si la carpeta ya termina en \\ (raíz de una unidad)', () => {
      const [record] = EverythingPageMapper.toDocumentRecords(
        page({ name: 'Aha', path: 'Z:\\' }),
      );

      expect(record.fullPath).toBe('Z:\\Aha');
    });
  });

  describe('la fecha de modificación', () => {
    it('convierte FILETIME a Date, incluso antes de 1970', () => {
      const at = (filetime: string): Date =>
        EverythingPageMapper.toDocumentRecords(
          page({ date_modified: filetime }),
        )[0].modifiedAt;

      expect(at('116444736000000000')).toEqual(new Date(0));
      expect(at('0')).toEqual(new Date('1601-01-01T00:00:00.000Z'));
    });
  });

  describe('dada una página con una forma inválida', () => {
    it.each<[string, unknown, string]>([
      ['no es un objeto', 'texto', 'no es un objeto'],
      ['es null', null, 'no es un objeto'],
      ['es una lista', [], 'no es un objeto'],
      [
        'falta totalResults',
        { results: [] },
        'totalResults no es un entero mayor o igual que 0',
      ],
      [
        'totalResults es texto',
        { totalResults: '1', results: [] },
        'totalResults no es un entero mayor o igual que 0',
      ],
      [
        'totalResults es negativo',
        { totalResults: -1, results: [] },
        'totalResults no es un entero mayor o igual que 0',
      ],
      ['falta results', { totalResults: 0 }, 'falta la lista results'],
      [
        'results no es una lista',
        { totalResults: 0, results: {} },
        'falta la lista results',
      ],
    ])('lanza el error de dominio cuando %s', (_case, input, reason) => {
      expect(reasonOf(input)).toBe(reason);
    });

    it.each<[string, Record<string, unknown>, string]>([
      [
        'type no es folder ni file',
        { type: 'link' },
        'type no es folder ni file',
      ],
      ['falta name', { name: undefined }, 'name no es un texto con contenido'],
      ['name está vacío', { name: '' }, 'name no es un texto con contenido'],
      ['path es un número', { path: 7 }, 'path no es un texto'],
      ['size es un número', { size: 0 }, 'size no es un número en texto'],
      ['size no es número', { size: '12 KB' }, 'size no es un número en texto'],
      [
        'size no cabe en un número',
        { size: '9'.repeat(20) },
        'size es demasiado grande',
      ],
      [
        'la fecha no es número',
        { date_modified: '2026-11-20' },
        'date_modified no es un número en texto',
      ],
      [
        'la fecha es un número y no texto',
        { date_modified: 134396687063866 },
        'date_modified no es un número en texto',
      ],
      [
        'la fecha está vacía',
        { date_modified: '' },
        'date_modified no es un número en texto',
      ],
      [
        'la fecha se sale del rango de Date',
        { date_modified: '9'.repeat(30) },
        'date_modified está fuera del rango de fechas',
      ],
    ])('lanza el error de dominio cuando %s', (_case, result, reason) => {
      expect(reasonOf(page(result))).toBe(`results[0]: ${reason}`);
    });

    it('un resultado que no es un objeto también rechaza la página', () => {
      expect(reasonOf({ totalResults: 1, results: ['1080'] })).toBe(
        'results[0]: no es un objeto',
      );
    });

    it('no devuelve resultados parciales: un solo resultado malo rechaza toda la página', () => {
      const p1 = fixture('carpetas_notarias_p1') as {
        results: Record<string, unknown>[];
      };
      p1.results[49] = { ...p1.results[49], date_modified: 'ayer' };

      expect(reasonOf(p1)).toBe(
        'results[49]: date_modified no es un número en texto',
      );
    });

    it('el mensaje dice que la página de Everything es inválida', () => {
      expect(() => EverythingPageMapper.toDocumentRecords({})).toThrow(
        'Página de Everything inválida',
      );
    });
  });
});
