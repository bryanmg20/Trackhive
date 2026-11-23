import { readFileSync } from 'fs';
import { join } from 'path';
import type { DocumentRecord } from '../dto/document-record';
import type { ParsedLeaf } from '../dto/parsed-leaf';
import { CatalogConventionMapper } from '../mappers/catalog-convention.mapper';
import { EverythingPageMapper } from '../mappers/everything-page.mapper';
import { LeafFolderParser } from './leaf-folder-parser';

// Manifest and real answers of Everything (HU-133), and the convention file
const DEV = join(__dirname, '../../../../../dev');
const CONVENTION_FILE = join(
  __dirname,
  '../../../../config/catalog-convention.json',
);
const BASE = 'C:\\trackhive\\docs_simulados';
const NOTARIAS = `${BASE}\\Aha\\Fondo - Notarías\\Notarías`;
const PRIMERA = '1ra - Notaria Primera de Barranquilla - 1815 a 1979';
const AT = new Date('2026-11-20T00:00:00.000Z');

interface ManifestLeaf {
  path: string;
  relativePath: string;
  folderName: string;
  parsedCode: string | null;
  catalogCode: string;
  title: string;
  collection: string;
  materialType: string;
  needsReview: boolean;
  reviewReason: string | null;
}

interface Manifest {
  windowsRoot: string;
  summary: { leaves: number; valid: number; needsReview: number };
  leaves: ManifestLeaf[];
  excluded: { path: string }[];
}

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(file, 'utf8'));
const conventionJson = (): Record<string, unknown> =>
  readJson(CONVENTION_FILE) as Record<string, unknown>;
const manifest = readJson(join(DEV, 'manifiesto.json')) as Manifest;
const fixture = (id: string): DocumentRecord[] =>
  EverythingPageMapper.toDocumentRecords(
    readJson(join(DEV, 'fixtures', `everything_${id}.json`)),
  );

/** A folder as EverythingPageMapper gives it. */
const folder = (fullPath: string): DocumentRecord => {
  const cut = fullPath.lastIndexOf('\\');
  return {
    name: fullPath.slice(cut + 1),
    parentPath: fullPath.slice(0, cut),
    fullPath,
    kind: 'folder',
    modifiedAt: AT,
  };
};

/** The folder and every folder above it, up to the base. */
const withParents = (relativeToBase: string): DocumentRecord[] => {
  const parts = relativeToBase.split('\\');
  return parts.map((_, i) =>
    folder(`${BASE}\\${parts.slice(0, i + 1).join('\\')}`),
  );
};

const parser = (json: unknown = conventionJson(), base?: string) =>
  new LeafFolderParser(CatalogConventionMapper.fromJson(json, base));

const parseOne = (relativeToNotarias: string): ParsedLeaf => {
  const leaves = parser().parse([folder(`${NOTARIAS}\\${relativeToNotarias}`)]);
  expect(leaves).toHaveLength(1);
  return leaves[0];
};

describe('LeafFolderParser', () => {
  describe('con el manifiesto de HU-133', () => {
    // Notarías and Periódicos come as real Everything answered them; the
    // Correspondencia fund has no fixture, so its folders come from the
    // manifest. The work folders outside the roots go in too
    const records = [
      ...fixture('carpetas_notarias_p1'),
      ...fixture('carpetas_notarias_p2'),
      ...fixture('carpetas_notarias_p3'),
      ...fixture('carpetas_periodicos'),
      // Captured without size_column: only its path and name are used
      ...(
        readJson(
          join(DEV, 'fixtures', 'everything_carpetas_fuera_de_raiz.json'),
        ) as { results: { path: string; name: string }[] }
      ).results.map((result) => folder(`${result.path}\\${result.name}`)),
      ...manifest.leaves
        .filter((leaf) => leaf.collection === 'Correspondencia')
        .flatMap((leaf) => withParents(leaf.path)),
      ...manifest.excluded.map((excluded) =>
        folder(`${BASE}\\${excluded.path}`),
      ),
    ];
    const leaves = parser().parse(records);
    const byPath = new Map(leaves.map((leaf) => [leaf.fullPath, leaf]));

    it('calcula exactamente las hojas del manifiesto, sin las carpetas de trabajo', () => {
      const expected = manifest.leaves.map(
        (leaf) => `${manifest.windowsRoot}\\${leaf.path}`,
      );

      expect(leaves).toHaveLength(manifest.summary.leaves);
      expect([...byPath.keys()].sort()).toEqual([...expected].sort());
      expect(leaves.filter((leaf) => !leaf.needsReview)).toHaveLength(
        manifest.summary.valid,
      );
    });

    it.each(manifest.leaves.map((leaf) => [leaf.relativePath, leaf] as const))(
      '%s',
      (_path, expected) => {
        const leaf = byPath.get(`${manifest.windowsRoot}\\${expected.path}`);

        expect(leaf).toEqual({
          fullPath: `${manifest.windowsRoot}\\${expected.path}`,
          relativePath: expected.relativePath,
          folderName: expected.folderName,
          parsedCode: expected.parsedCode,
          catalogCode: expected.catalogCode,
          title: expected.title,
          collection: expected.collection,
          materialType: expected.materialType,
          needsReview: expected.needsReview,
          reviewReason: expected.reviewReason,
        });
      },
    );

    it('no repite ningún código de catalogación y ninguno pasa de 40 caracteres', () => {
      const codes = leaves.map((leaf) => leaf.catalogCode);

      expect(new Set(codes).size).toBe(codes.length);
      expect(codes.filter((code) => code.length > 40)).toEqual([]);
    });
  });

  describe('el parseo por niveles', () => {
    it('saca código, título, colección y tipo del ejemplo de la HU', () => {
      expect(
        parseOne(
          `${PRIMERA}\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0001-0109 - Ene`,
        ),
      ).toEqual({
        fullPath: `${NOTARIAS}\\${PRIMERA}\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0001-0109 - Ene`,
        relativePath: `${PRIMERA}\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0001-0109 - Ene`,
        folderName: '1ra-1931 - Esc 0001-0109 - Ene',
        parsedCode: 'NOT1-1931-0001-0109',
        catalogCode: 'NOT1-1931-0001-0109',
        title:
          'Notaría Primera de Barranquilla · 1931 · Escrituras 1–109 (enero)',
        collection: 'Notarías',
        materialType: 'PROTOCOLO_NOTARIAL',
        needsReview: false,
        reviewReason: null,
      });
    });

    it.each([
      '1940 - Esc 1-1783 (13) + ptes',
      '1945 - Esc 1-2162 (15) + Ptes',
      '1935 - Esc 1-0777 (12)',
      '1935 - Esc 1-777',
    ])('ignora las marcas +, ptes y (n) del año: %s', (year) => {
      expect(
        parseOne(`${PRIMERA}\\${year}\\1ra-1940 - Esc 0001-0161 - Ene`)
          .parsedCode,
      ).toBe('NOT1-1940-0001-0161');
    });

    it('ignora el conteo de la notaría y normaliza los ceros a la izquierda', () => {
      const leaf = parseOne(
        '3ra - Notaria Tercera de Barranquilla - 1929 a 1950 (499)\\1950 - Esc 1-3733 (13)\\3ra-1950 - Esc 51-160 - Ene',
      );

      expect(leaf.catalogCode).toBe('NOT3-1950-0051-0160');
      expect(leaf.title).toBe(
        'Notaría Tercera de Barranquilla · 1950 · Escrituras 51–160 (enero)',
      );
    });

    it('un rango que baja no sigue el patrón', () => {
      const leaf = parseOne(
        `${PRIMERA}\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0200-0100 - Ene`,
      );

      expect(leaf).toMatchObject({
        parsedCode: null,
        needsReview: true,
        reviewReason: 'NO_PATTERN',
      });
    });

    it('un código de más de 40 caracteres usa el respaldo', () => {
      const leaf = parseOne(
        `${PRIMERA}\\1931 - Esc 1-1290\\1ra-1931 - Esc ${'1'.repeat(20)}-${'9'.repeat(20)} - Ene`,
      );

      expect(leaf.parsedCode).toBeNull();
      expect(leaf.catalogCode).toMatch(/^NOT-[0-9A-F]{8}$/);
    });
  });

  describe('las marcas solo se ignoran en su nivel', () => {
    it.each([
      '1ra-1931 - Esc 0001-0109 - Ene (2)',
      '1ra-1931 - Esc 0001-0109 - Ene +',
      '1ra-1931 - Esc 0001-0109 - Feb ptes',
    ])('una hoja con marcas no sigue el patrón: %s', (month) => {
      expect(
        parseOne(`${PRIMERA}\\1931 - Esc 1-1290 (12) +\\${month}`),
      ).toMatchObject({ parsedCode: null, reviewReason: 'NO_PATTERN' });
    });

    it('una copia con (2) no deja para revisión a la original', () => {
      const year = `${NOTARIAS}\\${PRIMERA}\\1931 - Esc 1-1290 (12) +`;
      const leaves = parser().parse([
        folder(`${year}\\1ra-1931 - Esc 0001-0109 - Ene`),
        folder(`${year}\\1ra-1931 - Esc 0001-0109 - Ene (2)`),
      ]);

      expect(leaves.map((leaf) => leaf.reviewReason)).toEqual([
        null,
        'NO_PATTERN',
      ]);
    });
  });

  describe('el respaldo', () => {
    it.each([
      ['1080', 'NOT-71F384CA', 'Notaría Primera de Barranquilla · 1080'],
      [
        '1ra - Matrimonios',
        'NOT-84E0CF7A',
        'Notaría Primera de Barranquilla · 1ra - Matrimonios',
      ],
    ])(
      'dada la hoja %s, no falla y queda para revisión',
      (name, code, title) => {
        expect(parseOne(`${PRIMERA}\\${name}`)).toMatchObject({
          parsedCode: null,
          catalogCode: code,
          title,
          needsReview: true,
          reviewReason: 'NO_PATTERN',
        });
      },
    );

    it('sin la notaría en el nivel superior, el título es solo el nombre de la carpeta', () => {
      expect(parseOne('Sueltas\\1080').title).toBe('1080');
    });

    it('el mismo código en dos hojas deja las dos para revisión con el código de su ruta', () => {
      const year = `${NOTARIAS}\\${PRIMERA}\\1940 - Esc 1-1783 (13) + ptes`;
      const leaves = parser().parse([
        folder(`${year}\\1ra-1940 - Esc 0001-0161 - Ene`),
        folder(`${year}\\1ra-1940 - Esc 1-161 - Ene`),
        folder(`${year}\\1ra-1940 - Esc 0162-0300 - Feb`),
      ]);

      expect(leaves.map((leaf) => leaf.reviewReason)).toEqual([
        'DUPLICATE_CODE',
        'DUPLICATE_CODE',
        null,
      ]);
      expect(leaves.map((leaf) => leaf.catalogCode)).toEqual([
        'NOT-F1082785',
        'NOT-A07D63CC',
        'NOT1-1940-0162-0300',
      ]);
      expect(leaves[0].parsedCode).toBe('NOT1-1940-0001-0161');
    });

    it('la misma ruta en otra forma Unicode da el mismo código', () => {
      const nfd = `${PRIMERA}\\1080`.normalize('NFD');
      const [leaf] = parser().parse([folder(`${NOTARIAS}\\${nfd}`)]);

      expect(leaf.catalogCode).toBe('NOT-71F384CA');
    });
  });

  describe('los códigos de catalogación', () => {
    // A fund whose code is a hex id: the folder «71F384CA» gives NOT-71F384CA,
    // the same code as the fallback of «…\\1080»
    const hexFund = (): unknown => ({
      ...conventionJson(),
      patterns: {
        notarias: {
          levels: [{ pattern: '^(?<id>[0-9A-F]{8})$' }],
          code: '{prefix}-{id}',
          title: 'Carpeta {id}',
        },
      },
    });

    it('si un código final choca con otro, las dos hojas toman el hash largo y quedan para revisión', () => {
      const leaves = parser(hexFund()).parse([
        folder(`${NOTARIAS}\\71F384CA`),
        folder(`${NOTARIAS}\\${PRIMERA}\\1080`),
        folder(`${NOTARIAS}\\0000ABCD`),
      ]);

      expect(leaves.map((leaf) => leaf.catalogCode)).toEqual([
        expect.stringMatching(/^NOT-[0-9A-F]{16}$/),
        expect.stringMatching(/^NOT-71F384CA[0-9A-F]{8}$/),
        'NOT-0000ABCD',
      ]);
      expect(leaves.map((leaf) => leaf.reviewReason)).toEqual([
        'DUPLICATE_CODE',
        'DUPLICATE_CODE',
        null,
      ]);
      expect(new Set(leaves.map((leaf) => leaf.catalogCode)).size).toBe(3);
    });

    it('un código con minúsculas o espacios no sigue el patrón', () => {
      const json = hexFund() as {
        patterns: { notarias: { levels: unknown[] } };
      };
      json.patterns.notarias.levels = [{ pattern: '^(?<id>[0-9A-Fa-f ]{8})$' }];

      expect(
        parser(json).parse([folder(`${NOTARIAS}\\ab 12345`)])[0],
      ).toMatchObject({ parsedCode: null, reviewReason: 'NO_PATTERN' });
    });

    it('un valor heredado del prototipo no está en la tabla de valores', () => {
      const json = conventionJson() as {
        patterns: { notarias: { levels: { pattern: string }[] } };
      };
      json.patterns.notarias.levels[2].pattern =
        '^(?<notaria>\\d+)ra-(?<anio>\\d{4}) - Esc (?<inicio>\\d+)-(?<fin>\\d+) - (?<mes>\\w+)$';
      const [leaf] = parser(json).parse([
        folder(
          `${NOTARIAS}\\${PRIMERA}\\1931 - Esc 1-1290\\1ra-1931 - Esc 0001-0109 - constructor`,
        ),
      ]);

      expect(leaf).toMatchObject({
        parsedCode: null,
        reviewReason: 'NO_PATTERN',
      });
    });
  });

  describe('las carpetas hoja', () => {
    it('una carpeta con subcarpetas no es material; los archivos no cuentan', () => {
      const month = `${NOTARIAS}\\${PRIMERA}\\1931 - Esc 1-1290\\1ra-1931 - Esc 0001-0109 - Ene`;
      const leaves = parser().parse([
        folder(`${NOTARIAS}\\${PRIMERA}`),
        folder(`${NOTARIAS}\\${PRIMERA}\\1931 - Esc 1-1290`),
        folder(month),
        {
          ...folder(`${month}\\001 - 1ra - 1931 - Esc 0001.jpg`),
          kind: 'file',
          size: 0,
        },
      ]);

      expect(leaves.map((leaf) => leaf.fullPath)).toEqual([month]);
    });

    it('compara la raíz por partes de la ruta y sin distinguir mayúsculas', () => {
      const leaves = parser().parse([
        folder(`${BASE}\\Aha\\Fondo - Notarías\\Esc en PDF`),
        folder(`${BASE}\\Aha\\Fondo - Notarías\\NotaríasX\\1080`),
        folder(`${BASE.toUpperCase()}\\AHA\\FONDO - NOTARÍAS\\NOTARÍAS\\1080`),
      ]);

      expect(leaves.map((leaf) => leaf.fullPath)).toEqual([
        `${BASE.toUpperCase()}\\AHA\\FONDO - NOTARÍAS\\NOTARÍAS\\1080`,
      ]);
    });

    it('la propia raíz no es un material', () => {
      expect(parser().parse([folder(NOTARIAS)])).toEqual([]);
    });

    it('una carpeta que llega dos veces da un solo material', () => {
      const path = `${NOTARIAS}\\${PRIMERA}\\1931 - Esc 1-1290\\1ra-1931 - Esc 0001-0109 - Ene`;
      const leaves = parser().parse([folder(path), folder(path)]);

      expect(leaves).toHaveLength(1);
      expect(leaves[0].needsReview).toBe(false);
    });
  });

  describe('la configuración', () => {
    it('la base cambia según el despliegue (unidad de red o ruta UNC)', () => {
      const unc = '\\\\servidor\\Multimedia';
      const leaves = parser(conventionJson(), unc).parse([
        folder(`${unc}\\Aha\\Fondo - Notarías\\Notarías\\${PRIMERA}\\1080`),
        folder(`${NOTARIAS}\\${PRIMERA}\\1823 - 1827`),
      ]);

      expect(leaves.map((leaf) => leaf.catalogCode)).toEqual(['NOT-71F384CA']);
    });

    it('las exclusiones se quitan antes de calcular las hojas', () => {
      const month = `${NOTARIAS}\\${PRIMERA}\\1931 - Esc 1-1290\\1ra-1931 - Esc 0001-0109 - Ene`;
      const leaves = parser({
        ...conventionJson(),
        excluded: ['^PDF$'],
      }).parse([folder(month), folder(`${month}\\pdf`)]);

      expect(leaves.map((leaf) => leaf.catalogCode)).toEqual([
        'NOT1-1931-0001-0109',
      ]);
    });

    it('el tipo de material sale de la tabla, y cualquier otro fondo es DOCUMENTO', () => {
      const json = conventionJson();
      const leaves = parser({
        ...json,
        materialTypes: { Notarías: 'OTRO' },
        funds: [
          ...(json.funds as unknown[]),
          { root: 'Aha\\Fondo - Mapas', collection: 'Mapas', prefix: 'MAP' },
        ],
      }).parse([
        folder(`${NOTARIAS}\\${PRIMERA}\\1080`),
        folder(`${BASE}\\Aha\\Fondo - Periódicos\\1925`),
        folder(`${BASE}\\Aha\\Fondo - Mapas\\Barranquilla 1897`),
      ]);

      expect(
        leaves.map((leaf) => [leaf.collection, leaf.materialType]),
      ).toEqual([
        ['Notarías', 'OTRO'],
        ['Periódicos', 'DOCUMENTO'],
        ['Mapas', 'DOCUMENTO'],
      ]);
      expect(leaves[2]).toMatchObject({
        title: 'Barranquilla 1897',
        reviewReason: 'NO_PATTERN',
      });
      expect(leaves[2].catalogCode).toMatch(/^MAP-[0-9A-F]{8}$/);
    });

    it('un título de más de 255 caracteres se recorta', () => {
      const title = parseOne(`Sueltas\\${'a'.repeat(300)}`).title;

      expect(title).toHaveLength(255);
      expect(title.endsWith('…')).toBe(true);
    });

    it('el recorte no parte un emoji en dos', () => {
      const title = parseOne(`Sueltas\\${'a'.repeat(253)}😀x`).title;

      expect(title).toBe(`${'a'.repeat(253)}…`);
      // A lone surrogate does not survive a round trip through UTF-8
      expect(Buffer.from(title, 'utf8').toString('utf8')).toBe(title);
    });
  });
});
