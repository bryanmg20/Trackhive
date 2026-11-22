import {
  isMaterialType,
  MaterialType,
} from '../../../materials/domain/enums/material-type';
import { InvalidCatalogConventionError } from '../../domain/errors/invalid-catalog-convention.error';
import {
  CatalogConvention,
  FundConvention,
  FundPattern,
  LevelPattern,
} from '../dto/catalog-convention';
import {
  isUnder,
  MAX_PREFIX_LENGTH,
  nfc,
  pathKey,
  placeholders,
  PREFIX_PLACEHOLDER,
  splitPath,
} from '../services/catalog-paths';

// materials.collection is varchar(120)
const MAX_COLLECTION_LENGTH = 120;
const PREFIX = /^[A-Z0-9]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (reason: string): never => {
  throw new InvalidCatalogConventionError(reason);
};

/** A typo in a key would be ignored silently: every key must be known. */
const onlyKeys = (
  value: Record<string, unknown>,
  allowed: string[],
  where: string,
): void => {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined) {
    fail(`${where} tiene la clave desconocida ${unknown}`);
  }
};

const object = (value: unknown, where: string): Record<string, unknown> =>
  isRecord(value) ? value : fail(`${where} no es un objeto`);

const text = (value: unknown, where: string): string =>
  typeof value === 'string' && value.trim() !== ''
    ? value
    : fail(`${where} no es un texto con contenido`);

const list = (value: unknown, where: string): unknown[] =>
  Array.isArray(value) ? value : fail(`${where} no es una lista`);

const regex = (value: unknown, where: string, flags: string): RegExp => {
  try {
    return new RegExp(text(value, where), flags);
  } catch {
    return fail(`${where} no es una expresión regular válida`);
  }
};

/** Names of the named groups of a pattern, without matching anything. */
const groupsOf = (pattern: RegExp): string[] =>
  Object.keys(new RegExp(`${pattern.source}|`, 'u').exec('')?.groups ?? {});

const groupsIn = (template: string): string[] =>
  [...template.matchAll(placeholders())].map(([, group]) => group);

/** Tables are built without a prototype: `constructor` is not a key. */
const table = <T>(): Record<string, T> =>
  Object.create(null) as Record<string, T>;

interface TypeTable {
  byCollection: Record<string, MaterialType>;
  fallback: MaterialType;
}

/**
 * Checks the JSON of the folder convention (config/catalog-convention.json,
 * HU-136) and compiles its patterns. Any mistake stops with
 * InvalidCatalogConventionError, so a wrong file fails when it is loaded and
 * not in the middle of a sync.
 */
export class CatalogConventionMapper {
  /**
   * @param base overrides `base` of the file: where the funds live in this
   * deployment (`C:\trackhive\docs_simulados`, `Z:\`, `\\server\Multimedia`)
   */
  static fromJson(json: unknown, base?: string): CatalogConvention {
    const root = object(json, 'la convención');
    onlyKeys(
      root,
      [
        '$comment',
        'base',
        'defaultMaterialType',
        'materialTypes',
        'excluded',
        'funds',
        'patterns',
      ],
      'la convención',
    );
    const baseParts = splitPath(text(base ?? root.base, 'base'));
    const types = CatalogConventionMapper.typeTable(root);
    const patterns = object(root.patterns ?? {}, 'patterns');
    const funds = list(root.funds, 'funds').map((fund, index) =>
      CatalogConventionMapper.fund(fund, `funds[${index}]`, {
        baseParts,
        types,
        patterns,
      }),
    );
    CatalogConventionMapper.checkFunds(funds, types);
    // Like the paths, an exclusion does not tell upper from lower case
    const excluded = list(root.excluded ?? [], 'excluded').map((value, i) =>
      regex(value, `excluded[${i}]`, 'iu'),
    );
    return { funds, excluded };
  }

  /**
   * Prefixes are not repeated, and a root is neither the same as another
   * nor inside it: each folder belongs to one fund only.
   */
  private static checkFunds(funds: FundConvention[], types: TypeTable): void {
    if (funds.length === 0) {
      fail('funds está vacía');
    }
    funds.forEach((fund, i) => {
      funds.slice(i + 1).forEach((other, j) => {
        const where = `funds[${i}] y funds[${i + j + 1}]`;
        if (fund.prefix === other.prefix) {
          fail(`el prefijo ${fund.prefix} está en dos fondos`);
        }
        if (
          pathKey(fund.root) === pathKey(other.root) ||
          isUnder(fund.root, other.root) ||
          isUnder(other.root, fund.root)
        ) {
          fail(`${where} tienen la misma raíz o una dentro de la otra`);
        }
      });
    });
    const collections = new Set(funds.map((fund) => fund.collection));
    const orphan = Object.keys(types.byCollection).find(
      (collection) => !collections.has(collection),
    );
    if (orphan !== undefined) {
      fail(`materialTypes.${orphan} no es la colección de ningún fondo`);
    }
  }

  /** Type of material by collection (in NFC); any other is the default. */
  private static typeTable(json: Record<string, unknown>): TypeTable {
    const fallback = text(json.defaultMaterialType, 'defaultMaterialType');
    if (!isMaterialType(fallback)) {
      return fail(`defaultMaterialType ${fallback} no es un tipo de material`);
    }
    const byCollection = table<MaterialType>();
    for (const [collection, type] of Object.entries(
      object(json.materialTypes ?? {}, 'materialTypes'),
    )) {
      if (typeof type !== 'string' || !isMaterialType(type)) {
        return fail(`materialTypes.${collection} no es un tipo de material`);
      }
      byCollection[nfc(collection)] = type;
    }
    return { byCollection, fallback };
  }

  private static fund(
    value: unknown,
    where: string,
    context: {
      baseParts: string[];
      types: TypeTable;
      patterns: Record<string, unknown>;
    },
  ): FundConvention {
    const fund = object(value, where);
    onlyKeys(fund, ['root', 'collection', 'prefix', 'pattern'], where);
    const root = splitPath(text(fund.root, `${where}.root`));
    if (root.length === 0) {
      return fail(`${where}.root está vacía`);
    }
    const collection = nfc(text(fund.collection, `${where}.collection`));
    if (collection.length > MAX_COLLECTION_LENGTH) {
      return fail(`${where}.collection pasa de ${MAX_COLLECTION_LENGTH}`);
    }
    const prefix = text(fund.prefix, `${where}.prefix`);
    if (!PREFIX.test(prefix) || prefix.length > MAX_PREFIX_LENGTH) {
      return fail(
        `${where}.prefix debe tener de 1 a ${MAX_PREFIX_LENGTH} letras mayúsculas o dígitos`,
      );
    }
    let pattern: FundPattern | null = null;
    if (fund.pattern !== undefined && fund.pattern !== null) {
      const name = text(fund.pattern, `${where}.pattern`);
      if (!Object.hasOwn(context.patterns, name)) {
        return fail(`${where}.pattern ${name} no está en patterns`);
      }
      pattern = CatalogConventionMapper.pattern(
        context.patterns[name],
        `patterns.${name}`,
      );
    }
    return {
      root: [...context.baseParts, ...root],
      collection,
      prefix,
      materialType: Object.hasOwn(context.types.byCollection, collection)
        ? context.types.byCollection[collection]
        : context.types.fallback,
      pattern,
    };
  }

  private static pattern(value: unknown, where: string): FundPattern {
    const pattern = object(value, where);
    onlyKeys(pattern, ['levels', 'ranges', 'values', 'code', 'title'], where);
    const levels = list(pattern.levels, `${where}.levels`).map((level, i) =>
      CatalogConventionMapper.level(level, `${where}.levels[${i}]`),
    );
    if (levels.length === 0) {
      return fail(`${where}.levels está vacía`);
    }
    const groups = levels.flatMap((level) => groupsOf(level.pattern));
    const repeated = groups.find((g, i) => groups.indexOf(g) !== i);
    if (repeated) {
      return fail(`${where}: el grupo ${repeated} está en dos niveles`);
    }
    // ranges and values only make sense for what the folders give
    const levelGroup = (group: unknown, at: string): string => {
      const name = text(group, at);
      return groups.includes(name)
        ? name
        : fail(`${at}: no hay un grupo ${name}`);
    };

    const ranges = list(pattern.ranges ?? [], `${where}.ranges`).map(
      (range, i): [string, string] => {
        const pair = list(range, `${where}.ranges[${i}]`);
        if (pair.length !== 2) {
          return fail(`${where}.ranges[${i}] no es un par de grupos`);
        }
        return [
          levelGroup(pair[0], `${where}.ranges[${i}]`),
          levelGroup(pair[1], `${where}.ranges[${i}]`),
        ];
      },
    );

    const values = table<Record<string, string>>();
    for (const [group, entries] of Object.entries(
      object(pattern.values ?? {}, `${where}.values`),
    )) {
      levelGroup(group, `${where}.values`);
      const at = `${where}.values.${group}`;
      const texts = table<string>();
      for (const [key, text] of Object.entries(object(entries, at))) {
        texts[key] =
          typeof text === 'string'
            ? text
            : fail(`${at} no es una tabla de textos`);
      }
      values[group] = texts;
    }

    const template = (key: 'code' | 'title'): string => {
      const at = `${where}.${key}`;
      const source = text(pattern[key], at);
      const used = groupsIn(source);
      const unknown = used.find(
        (group) => group !== PREFIX_PLACEHOLDER && !groups.includes(group),
      );
      if (unknown !== undefined) {
        return fail(`${at}: no hay un grupo ${unknown}`);
      }
      // Without a group of the folders every leaf would get the same code
      if (!used.some((group) => groups.includes(group))) {
        return fail(`${at} no usa ningún grupo de los niveles`);
      }
      return source;
    };
    // A level title only sees the groups of its own level
    levels.forEach((level, i) => {
      const unknown =
        level.title === null
          ? undefined
          : groupsIn(level.title).find(
              (group) => !groupsOf(level.pattern).includes(group),
            );
      if (unknown !== undefined) {
        fail(`${where}.levels[${i}].title: no hay un grupo ${unknown}`);
      }
    });

    return {
      levels,
      ranges,
      values,
      code: template('code'),
      title: template('title'),
    };
  }

  private static level(value: unknown, where: string): LevelPattern {
    const level = object(value, where);
    onlyKeys(level, ['pattern', 'title', 'ignoredMarks'], where);
    const source = text(level.pattern, `${where}.pattern`);
    // Wrapped, so that `^a|b$` cannot match only a part of the name
    regex(source, `${where}.pattern`, 'u');
    return {
      // Global: removes every occurrence, not only the first
      ignoredMarks: list(level.ignoredMarks ?? [], `${where}.ignoredMarks`).map(
        (mark, i) => regex(mark, `${where}.ignoredMarks[${i}]`, 'gu'),
      ),
      pattern: new RegExp(`^(?:${source})$`, 'u'),
      title:
        level.title === undefined || level.title === null
          ? null
          : text(level.title, `${where}.title`),
    };
  }
}
