import { readFileSync } from 'fs';
import { join } from 'path';
import { InvalidCatalogConventionError } from '../../domain/errors/invalid-catalog-convention.error';
import { CatalogConventionMapper } from './catalog-convention.mapper';

const CONVENTION_FILE = join(
  __dirname,
  '../../../../config/catalog-convention.json',
);

/** Shape of config/catalog-convention.json, to break it in the tests. */
interface Json {
  base?: string;
  defaultMaterialType?: string;
  materialTypes: Record<string, string>;
  excluded?: unknown[];
  excludes?: unknown[];
  funds?: {
    root: string;
    prefix: string;
    collection: string;
    pattern?: string;
    patern?: string;
  }[];
  patterns: {
    notarias: {
      levels: { pattern: string; title?: string }[];
      code: string;
      ranges: unknown[];
      values: Record<string, Record<string, string>>;
    };
  };
}

const convention = (): Json =>
  JSON.parse(readFileSync(CONVENTION_FILE, 'utf8')) as Json;

/** The convention file with one change. */
const changed = (change: (json: Json) => void): Json => {
  const json = convention();
  change(json);
  return json;
};

const reasonOf = (json: unknown): string => {
  try {
    CatalogConventionMapper.fromJson(json);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidCatalogConventionError);
    expect((error as InvalidCatalogConventionError).code).toBe(
      'INVALID_CATALOG_CONVENTION',
    );
    return (error as InvalidCatalogConventionError).reason;
  }
  throw new Error('No lanzó InvalidCatalogConventionError');
};

describe('CatalogConventionMapper', () => {
  it('carga config/catalog-convention.json con los tres fondos del CLENA', () => {
    const { funds, excluded } = CatalogConventionMapper.fromJson(convention());

    expect(
      funds.map((fund) => [
        fund.root.join('\\'),
        fund.collection,
        fund.prefix,
        fund.materialType,
        fund.pattern === null ? 'respaldo' : 'patrón',
      ]),
    ).toEqual([
      [
        'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Notarías\\Notarías',
        'Notarías',
        'NOT',
        'PROTOCOLO_NOTARIAL',
        'patrón',
      ],
      [
        'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Periódicos',
        'Periódicos',
        'PER',
        'PERIODICO',
        'respaldo',
      ],
      [
        'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Correspondencia',
        'Correspondencia',
        'DOC',
        'DOCUMENTO',
        'respaldo',
      ],
    ]);
    expect(excluded).toEqual([]);
  });

  it('la base del despliegue reemplaza la del archivo', () => {
    const { funds } = CatalogConventionMapper.fromJson(convention(), 'Z:\\');

    expect(funds[0].root).toEqual([
      'Z:',
      'Aha',
      'Fondo - Notarías',
      'Notarías',
    ]);
  });

  it.each<[string, (json: Json) => void, string]>([
    [
      'falta la base',
      (j) => delete j.base,
      'base no es un texto con contenido',
    ],
    ['falta funds', (j) => delete j.funds, 'funds no es una lista'],
    ['funds está vacía', (j) => (j.funds = []), 'funds está vacía'],
    [
      'el tipo por defecto no existe',
      (j) => (j.defaultMaterialType = 'LIBRO'),
      'defaultMaterialType LIBRO no es un tipo de material',
    ],
    [
      'la tabla tiene un tipo que no existe',
      (j) => (j.materialTypes.Notarías = 'ESCRITURA'),
      'materialTypes.Notarías no es un tipo de material',
    ],
    [
      'un prefijo tiene minúsculas',
      (j) => (j.funds![0].prefix = 'not'),
      'funds[0].prefix debe tener de 1 a 23 letras mayúsculas o dígitos',
    ],
    [
      'un prefijo no deja espacio al hash',
      (j) => (j.funds![0].prefix = 'N'.repeat(24)),
      'funds[0].prefix debe tener de 1 a 23 letras mayúsculas o dígitos',
    ],
    [
      'dos fondos tienen el mismo prefijo',
      (j) => (j.funds![1].prefix = 'NOT'),
      'el prefijo NOT está en dos fondos',
    ],
    [
      'la colección no cabe en la columna',
      (j) => (j.funds![0].collection = 'x'.repeat(121)),
      'funds[0].collection pasa de 120',
    ],
    [
      'el fondo usa un patrón que no existe',
      (j) => (j.funds![0].pattern = 'periodicos'),
      'funds[0].pattern periodicos no está en patterns',
    ],
    [
      'un nivel no es una expresión regular',
      (j) => (j.patterns.notarias.levels[1].pattern = '^(\\d{4}$'),
      'patterns.notarias.levels[1].pattern no es una expresión regular válida',
    ],
    [
      'un grupo está en dos niveles',
      (j) =>
        (j.patterns.notarias.levels[1].pattern =
          '^(?<anio>\\d{4}) - Esc \\d+-\\d+$'),
      'patterns.notarias: el grupo anio está en dos niveles',
    ],
    [
      'el código usa un grupo que no existe',
      (j) => (j.patterns.notarias.code = '{prefix}-{tomo}'),
      'patterns.notarias.code: no hay un grupo tomo',
    ],
    [
      'el título de un nivel usa un grupo de otro nivel',
      (j) => (j.patterns.notarias.levels[0].title = 'Notaría {anio}'),
      'patterns.notarias.levels[0].title: no hay un grupo anio',
    ],
    [
      'un rango no es un par',
      (j) => (j.patterns.notarias.ranges = [['inicio']]),
      'patterns.notarias.ranges[0] no es un par de grupos',
    ],
    [
      'una tabla de valores es de un grupo que no existe',
      (j) => (j.patterns.notarias.values.dia = { '1': 'uno' }),
      'patterns.notarias.values: no hay un grupo dia',
    ],
    [
      'una exclusión no es una expresión regular',
      (j) => (j.excluded = ['(']),
      'excluded[0] no es una expresión regular válida',
    ],
    [
      'una clave tiene una errata',
      (j) => {
        j.funds![0].patern = 'notarias';
      },
      'funds[0] tiene la clave desconocida patern',
    ],
    [
      'una clave de arriba tiene una errata',
      (j) => {
        j.excludes = [];
      },
      'la convención tiene la clave desconocida excludes',
    ],
    [
      'dos fondos tienen la misma raíz (sin distinguir mayúsculas)',
      (j) => (j.funds![2].root = 'aha\\fondo - periódicos'),
      'funds[1] y funds[2] tienen la misma raíz o una dentro de la otra',
    ],
    [
      'la raíz de un fondo está dentro de otra',
      (j) => (j.funds![1].root = 'Aha'),
      'funds[0] y funds[1] tienen la misma raíz o una dentro de la otra',
    ],
    [
      'la tabla de tipos nombra una colección que no existe',
      (j) => (j.materialTypes.Notarias = 'PROTOCOLO_NOTARIAL'),
      'materialTypes.Notarias no es la colección de ningún fondo',
    ],
    [
      'el código no usa ningún grupo de los niveles',
      (j) => (j.patterns.notarias.code = '{prefix}-1'),
      'patterns.notarias.code no usa ningún grupo de los niveles',
    ],
    [
      'un rango usa el prefijo',
      (j) => (j.patterns.notarias.ranges = [['prefix', 'fin']]),
      'patterns.notarias.ranges[0]: no hay un grupo prefix',
    ],
  ])('rechaza la convención cuando %s', (_case, change, reason) => {
    expect(reasonOf(changed(change))).toBe(reason);
  });

  it('la tabla de tipos acepta la colección en otra forma Unicode (NFD)', () => {
    const json = convention();
    json.materialTypes = { ['Notarías'.normalize('NFD')]: 'OTRO' };

    expect(CatalogConventionMapper.fromJson(json).funds[0].materialType).toBe(
      'OTRO',
    );
  });

  it('envuelve cada nivel en ^(?:…)$: una alternativa no coincide con parte del nombre', () => {
    const json = convention();
    json.patterns.notarias.levels[1].pattern = '^\\d{4}|x$';
    const [notarias] = CatalogConventionMapper.fromJson(json).funds;

    expect(notarias.pattern!.levels[1].pattern.test('1931 - Esc 1-1290')).toBe(
      false,
    );
  });

  it('el mensaje dice que la convención es inválida', () => {
    expect(() => CatalogConventionMapper.fromJson(null)).toThrow(
      'Convención de carpetas inválida: la convención no es un objeto',
    );
  });
});
