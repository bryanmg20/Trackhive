/**
 * Rules shared by CatalogConventionMapper and LeafFolderParser (HU-136):
 * how Windows paths are compared and what a catalog code may look like.
 */

export const SEP = '\\';

// materials.catalog_code is varchar(40). A code is upper case letters,
// digits and dashes
export const MAX_CODE_LENGTH = 40;
export const CATALOG_CODE = /^[A-Z0-9-]+$/;

// The fallback is <prefix>-<8 hex>; a code that still collides gets
// <prefix>-<16 hex>, so the prefix leaves room for 17 characters
export const SHORT_HASH = 8;
export const LONG_HASH = 16;
export const MAX_PREFIX_LENGTH = MAX_CODE_LENGTH - LONG_HASH - 1;

export const PREFIX_PLACEHOLDER = 'prefix';

/**
 * {group} or {group:N}. A new RegExp on every call: a shared /g regex keeps
 * lastIndex from one use to the next.
 */
export const placeholders = (): RegExp => /\{([A-Za-z_]\w*)(?::(\d+))?\}/g;

export const nfc = (value: string): string => value.normalize('NFC');

/** Windows path split by `\`, without empty parts (`Z:\`, `\\server`). */
export const splitPath = (path: string): string[] =>
  path.split(SEP).filter((part) => part !== '');

/** Windows does not tell upper from lower case in paths, nor NFC from NFD. */
export const pathKey = (parts: string[]): string =>
  parts.map((part) => nfc(part).toLowerCase()).join(SEP);

/** parts is strictly under root, comparing part by part. */
export const isUnder = (parts: string[], root: string[]): boolean =>
  parts.length > root.length &&
  pathKey(parts.slice(0, root.length)) === pathKey(root);
