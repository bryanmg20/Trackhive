import { createHash } from 'crypto';
import type {
  CatalogConvention,
  FundConvention,
  FundPattern,
} from '../dto/catalog-convention';
import type { DocumentRecord } from '../dto/document-record';
import type { ParsedLeaf } from '../dto/parsed-leaf';
import {
  CATALOG_CODE,
  isUnder,
  LONG_HASH,
  MAX_CODE_LENGTH,
  nfc,
  pathKey,
  placeholders,
  PREFIX_PLACEHOLDER,
  SEP,
  SHORT_HASH,
  splitPath,
} from './catalog-paths';

// materials.title is varchar(255)
const MAX_TITLE_LENGTH = 255;
const TITLE_SEPARATOR = ' · ';
const DIGITS = /^\d+$/;

interface Folder {
  record: DocumentRecord;
  fund: FundConvention;
  // Parts under the root of the fund, in NFC
  relative: string[];
  key: string;
  parentKey: string;
}

interface Parsed {
  code: string | null;
  title: string;
}

interface Candidate {
  fund: FundConvention;
  leaf: ParsedLeaf;
}

/**
 * Turns the folders of Everything into materials (HU-136). It only sees
 * DocumentRecord (HU-135), never the JSON of Everything, and the rules come
 * from the convention (config/catalog-convention.json), not from the code.
 *
 * It needs every folder under the roots at once: a folder is a leaf when no
 * other folder hangs from it, and a code is repeated when two leaves give it.
 */
export class LeafFolderParser {
  constructor(private readonly convention: CatalogConvention) {}

  parse(records: DocumentRecord[]): ParsedLeaf[] {
    const folders = this.foldersUnderRoots(records);
    const parents = new Set(folders.map((folder) => folder.parentKey));
    const leaves = folders.filter((folder) => !parents.has(folder.key));
    const candidates = leaves.map((folder) => ({
      fund: folder.fund,
      leaf: LeafFolderParser.toLeaf(folder),
    }));
    return LeafFolderParser.separateCollisions(
      LeafFolderParser.markRepeatedCodes(candidates),
    ).map(({ leaf }) => leaf);
  }

  /**
   * Folders strictly under a fund root, comparing by path parts (`Fondo -
   * Notarías\Esc en PDF` is not under `Fondo - Notarías\Notarías`), without
   * the excluded ones nor what hangs from them. Excluding them first lets
   * their parent be a leaf.
   */
  private foldersUnderRoots(records: DocumentRecord[]): Folder[] {
    const seen = new Set<string>();
    const folders: Folder[] = [];
    for (const record of records) {
      if (record.kind !== 'folder') {
        continue;
      }
      const parts = splitPath(record.fullPath);
      const fund = this.convention.funds.find((f) => isUnder(parts, f.root));
      const key = pathKey(parts);
      if (!fund || seen.has(key)) {
        continue;
      }
      seen.add(key);
      const relative = parts.slice(fund.root.length).map(nfc);
      if (
        relative.some((part) =>
          this.convention.excluded.some((exclusion) => exclusion.test(part)),
        )
      ) {
        continue;
      }
      folders.push({
        record,
        fund,
        relative,
        key,
        parentKey: pathKey(parts.slice(0, -1)),
      });
    }
    return folders;
  }

  private static toLeaf({ record, fund, relative }: Folder): ParsedLeaf {
    const relativePath = relative.join(SEP);
    const parsed = fund.pattern
      ? LeafFolderParser.byLevels(fund, fund.pattern, relative)
      : { code: null, title: relative[relative.length - 1] };
    return {
      fullPath: record.fullPath,
      relativePath,
      folderName: relative[relative.length - 1],
      parsedCode: parsed.code,
      catalogCode:
        parsed.code ??
        LeafFolderParser.fallbackCode(fund, relativePath, SHORT_HASH),
      title: LeafFolderParser.fit(parsed.title),
      collection: fund.collection,
      materialType: fund.materialType,
      needsReview: parsed.code === null,
      reviewReason: parsed.code === null ? 'NO_PATTERN' : null,
    };
  }

  /**
   * One pattern per level (notary, year, month). If every level matches, the
   * code and title come from the templates; if not, the fallback: the folder
   * name after the titles of the levels above that do match.
   */
  private static byLevels(
    fund: FundConvention,
    pattern: FundPattern,
    relative: string[],
  ): Parsed {
    // Each level removes its own marks; a level without named groups
    // matches with groups undefined
    const matches = relative.map((part, i) => {
      const level = pattern.levels[i];
      if (!level) {
        return null;
      }
      const cleaned = level.ignoredMarks
        .reduce((name, mark) => name.replace(mark, ''), part)
        .trim();
      const match = level.pattern.exec(cleaned);
      return match ? { ...match.groups } : null;
    });
    if (
      relative.length === pattern.levels.length &&
      matches.every((groups) => groups !== null)
    ) {
      const groups = Object.assign(
        { [PREFIX_PLACEHOLDER]: fund.prefix },
        ...matches,
      ) as Record<string, string | undefined>;
      const code = LeafFolderParser.render(pattern.code, groups, pattern);
      const title = LeafFolderParser.render(pattern.title, groups, pattern);
      const ordered = pattern.ranges.every(
        ([from, to]) =>
          DIGITS.test(groups[from] ?? '') &&
          DIGITS.test(groups[to] ?? '') &&
          Number(groups[from]) <= Number(groups[to]),
      );
      if (
        code !== null &&
        title !== null &&
        ordered &&
        code.length <= MAX_CODE_LENGTH &&
        CATALOG_CODE.test(code)
      ) {
        return { code, title };
      }
    }
    // Only the levels above the leaf give a title
    const above = matches.slice(0, -1).flatMap((groups, i) => {
      const levelTitle = pattern.levels[i]?.title;
      if (!groups || !levelTitle) {
        return [];
      }
      const rendered = LeafFolderParser.render(levelTitle, groups, pattern);
      return rendered === null ? [] : [rendered];
    });
    return {
      code: null,
      title: [...above, relative[relative.length - 1]].join(TITLE_SEPARATOR),
    };
  }

  /**
   * Fills {group} and {group:N}. A number loses its leading zeros (0001 and
   * 1 are the same deed) and N pads it again. null if a value is missing or
   * is not in its table of values.
   */
  private static render(
    template: string,
    groups: Record<string, string | undefined>,
    pattern: FundPattern,
  ): string | null {
    let missing = false;
    const result = template.replace(
      placeholders(),
      (_match, group: string, digits?: string) => {
        const raw = groups[group];
        // The tables have no prototype: `constructor` is not a value
        const table = pattern.values[group];
        let value = raw === undefined ? undefined : table ? table[raw] : raw;
        if (value === undefined) {
          missing = true;
          return '';
        }
        if (!table && DIGITS.test(value)) {
          value = value.replace(/^0+(?=\d)/, '');
          if (digits) {
            value = value.padStart(Number(digits), '0');
          }
        }
        return value;
      },
    );
    return missing ? null : result;
  }

  /**
   * Prefix of the fund plus the first hex digits (8, or 16 if that one
   * collides), in upper case, of the SHA-256 of the path under the root
   * (UTF-8, NFC, with `\`): NOT-71F384CA. The same folder always gives the
   * same code.
   */
  private static fallbackCode(
    fund: FundConvention,
    relativePath: string,
    digits: number,
  ): string {
    const digest = createHash('sha256')
      .update(nfc(relativePath), 'utf8')
      .digest('hex');
    return `${fund.prefix}-${digest.slice(0, digits).toUpperCase()}`;
  }

  /** The same code in two leaves: both for review, with their own code. */
  private static markRepeatedCodes(leaves: Candidate[]): Candidate[] {
    const counts = new Map<string, number>();
    for (const { leaf } of leaves) {
      if (leaf.parsedCode) {
        counts.set(leaf.parsedCode, (counts.get(leaf.parsedCode) ?? 0) + 1);
      }
    }
    return leaves.map(({ fund, leaf }) => ({
      fund,
      leaf:
        leaf.parsedCode && (counts.get(leaf.parsedCode) ?? 0) > 1
          ? LeafFolderParser.duplicate(fund, leaf, SHORT_HASH)
          : leaf,
    }));
  }

  /**
   * The code is the key of the sync (HU-137): two folders with the same one
   * would become one material. The short hash has 32 bits, so if a final
   * code still collides (two hashes, or a parsed code and a hash) those
   * leaves get the long hash and go for review.
   */
  private static separateCollisions(leaves: Candidate[]): Candidate[] {
    const counts = new Map<string, number>();
    for (const { leaf } of leaves) {
      counts.set(leaf.catalogCode, (counts.get(leaf.catalogCode) ?? 0) + 1);
    }
    return leaves.map(({ fund, leaf }) => ({
      fund,
      leaf:
        (counts.get(leaf.catalogCode) ?? 0) > 1
          ? LeafFolderParser.duplicate(fund, leaf, LONG_HASH)
          : leaf,
    }));
  }

  private static duplicate(
    fund: FundConvention,
    leaf: ParsedLeaf,
    digits: number,
  ): ParsedLeaf {
    return {
      ...leaf,
      catalogCode: LeafFolderParser.fallbackCode(
        fund,
        leaf.relativePath,
        digits,
      ),
      needsReview: true,
      reviewReason: 'DUPLICATE_CODE',
    };
  }

  /** Cut by code points, never in the middle of a surrogate pair. */
  private static fit(title: string): string {
    if (title.length <= MAX_TITLE_LENGTH) {
      return title;
    }
    let cut = '';
    for (const char of title) {
      if (cut.length + char.length > MAX_TITLE_LENGTH - 1) {
        break;
      }
      cut += char;
    }
    return `${cut}…`;
  }
}
