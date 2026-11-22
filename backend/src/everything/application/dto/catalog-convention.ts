import type { MaterialType } from '../../../materials/domain/enums/material-type';

/**
 * How the folders of the CLENA turn into materials (HU-136), already checked
 * and compiled by CatalogConventionMapper from config/catalog-convention.json.
 * Nothing of it is written in the code: roots, patterns, the type table and
 * the exclusions all come from that file.
 */
export interface CatalogConvention {
  funds: FundConvention[];
  // A folder whose name matches one of these (without telling upper from
  // lower case) is not a material, and neither is anything inside it
  excluded: RegExp[];
}

export interface FundConvention {
  // Absolute root of the fund, split by `\` (base + root of the file)
  root: string[];
  collection: string;
  // Start of every code of the fund: NOT1-…, and NOT-<hash> in the fallback
  prefix: string;
  materialType: MaterialType;
  // null: the pattern of the fund is not known, every leaf uses the fallback
  pattern: FundPattern | null;
}

/** One pattern per level under the root (notary → year → month). */
export interface FundPattern {
  levels: LevelPattern[];
  // Pairs of groups that must not go down (start ≤ end of the deeds)
  ranges: [string, string][];
  // Group value → text for the templates (Ene → enero); a value outside the
  // table means the folder does not follow the pattern
  values: Record<string, Record<string, string>>;
  // Templates with {group} or {group:N} (N digits with leading zeros) and
  // {prefix}. Numbers lose their leading zeros before N is applied
  code: string;
  title: string;
}

export interface LevelPattern {
  // Marks removed from the folder name of this level before matching: `(n)`
  // in the notary, `(n)`, `+` and `ptes` in the year
  ignoredMarks: RegExp[];
  // Compiled as ^(?:…)$, with named groups; names are unique across levels
  pattern: RegExp;
  // Title of the level with its own groups («Notaría Primera de
  // Barranquilla»). In the fallback it goes before the folder name
  title: string | null;
}
