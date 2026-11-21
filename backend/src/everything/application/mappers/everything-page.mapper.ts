import { InvalidEverythingPageError } from '../../domain/errors/invalid-everything-page.error';
import { DocumentKind, DocumentRecord } from '../dto/document-record';

// FILETIME counts 100 ns intervals since 1601-01-01 UTC; these are the
// intervals up to 1970-01-01, where Date starts
const FILETIME_UNIX_EPOCH = 116444736000000000n;
const FILETIME_TICKS_PER_MS = 10000n;
const DIGITS = /^\d+$/;
const KINDS: readonly string[] = ['folder', 'file'] satisfies DocumentKind[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Translates a raw page of the Everything HTTP server (`totalResults`,
 * `results`) into DocumentRecord (HU-135). The page arrives over the internet
 * from the agent (HU-166), so its shape is checked: if any part is wrong the
 * whole page is rejected with InvalidEverythingPageError, never a part of it.
 *
 * It expects the columns that the sync asks for (`path_column`, `size_column`
 * and `date_modified_column`). Everything sends every value as text.
 */
export class EverythingPageMapper {
  static toDocumentRecords(page: unknown): DocumentRecord[] {
    if (!isRecord(page)) {
      throw new InvalidEverythingPageError('no es un objeto');
    }
    const { totalResults, results } = page;
    if (
      typeof totalResults !== 'number' ||
      !Number.isSafeInteger(totalResults) ||
      totalResults < 0
    ) {
      throw new InvalidEverythingPageError(
        'totalResults no es un entero mayor o igual que 0',
      );
    }
    if (!Array.isArray(results)) {
      throw new InvalidEverythingPageError('falta la lista results');
    }
    return results.map((result: unknown, index) =>
      EverythingPageMapper.toDocumentRecord(result, index),
    );
  }

  private static toDocumentRecord(
    result: unknown,
    index: number,
  ): DocumentRecord {
    const fail = (reason: string): never => {
      throw new InvalidEverythingPageError(`results[${index}]: ${reason}`);
    };
    if (!isRecord(result)) {
      return fail('no es un objeto');
    }
    const { type, name, path, size, date_modified: dateModified } = result;
    if (typeof type !== 'string' || !KINDS.includes(type)) {
      return fail('type no es folder ni file');
    }
    if (typeof name !== 'string' || name === '') {
      return fail('name no es un texto con contenido');
    }
    if (typeof path !== 'string') {
      return fail('path no es un texto');
    }
    if (typeof size !== 'string' || (size !== '' && !DIGITS.test(size))) {
      return fail('size no es un número en texto');
    }
    if (typeof dateModified !== 'string' || !DIGITS.test(dateModified)) {
      return fail('date_modified no es un número en texto');
    }
    const modifiedAt = EverythingPageMapper.fromFiletime(dateModified);
    if (Number.isNaN(modifiedAt.getTime())) {
      return fail('date_modified está fuera del rango de fechas');
    }
    const sizeBytes = size === '' ? undefined : Number(size);
    if (sizeBytes !== undefined && !Number.isSafeInteger(sizeBytes)) {
      return fail('size es demasiado grande');
    }
    return {
      name,
      parentPath: path,
      fullPath: EverythingPageMapper.join(path, name),
      kind: type as DocumentKind,
      ...(sizeBytes === undefined ? {} : { size: sizeBytes }),
      modifiedAt,
    };
  }

  /** Windows FILETIME (text) -> Date, with BigInt: it exceeds 2^53. */
  private static fromFiletime(filetime: string): Date {
    const ms = (BigInt(filetime) - FILETIME_UNIX_EPOCH) / FILETIME_TICKS_PER_MS;
    // Outside ±8.64e15 ms new Date gives Invalid Date; Number() keeps it out
    return new Date(Number(ms));
  }

  /**
   * The indexed root comes with the full path as name and an empty path
   * (fixture everything_raiz_del_indice), so it is not joined. A drive root
   * may already end in `\`.
   */
  private static join(path: string, name: string): string {
    if (path === '') {
      return name;
    }
    return path.endsWith('\\') ? `${path}${name}` : `${path}\\${name}`;
  }
}
