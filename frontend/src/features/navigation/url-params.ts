import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/*
 * Filters, order and page of the list screens live in the query string, so
 * reloading, sharing the link or coming back from a detail keeps the search.
 *
 * Each screen writes a `parse` that reads only known, valid values (anything
 * else falls back to its default) and keeps it at module level, so the
 * parsed object only changes when the URL does.
 */

type Primitive = string | number | boolean | undefined;

export const SORT_ORDERS = ['asc', 'desc'] as const;

/** Drops the keys left undefined, so the params match the old literals. */
export function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

export function readText(search: URLSearchParams, key: string) {
  const value = search.get(key)?.trim();
  return value ? value : undefined;
}

export function readEnum<T extends string>(
  search: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = search.get(key);
  return allowed.find((item) => item === value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** «2026-11-20» only: the date inputs and the API use that form. */
export function readDate(search: URLSearchParams, key: string) {
  const value = search.get(key);
  return value && ISO_DATE.test(value) ? value : undefined;
}

/** `true` / `false`, or undefined when absent or anything else. */
export function readBoolean(search: URLSearchParams, key: string) {
  const value = search.get(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** Positive whole page number, 1 by default. */
export function readPage(search: URLSearchParams, key = 'page') {
  const value = Number(search.get(key));
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/**
 * Writes every set value except the ones equal to the default (and `limit`,
 * which the screen fixes), so a fresh screen keeps a clean URL.
 */
export function toSearchParams<T extends object>(
  value: T,
  defaults: T,
): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, item] of Object.entries(value) as [string, Primitive][]) {
    if (key === 'limit' || item === undefined || item === '') continue;
    if (item === (defaults as Record<string, Primitive>)[key]) continue;
    search.set(key, String(item));
  }
  return search;
}

/**
 * State of a list screen kept in the URL. Returns the parsed params, a
 * setter like `useState`'s and `reload` to fetch the same params again.
 *
 * Changes replace the history entry: «Atrás» leaves the screen instead of
 * undoing filters one by one, and still returns to the last search.
 */
export function useUrlParams<T extends object>(
  parse: (search: URLSearchParams) => T,
  defaults: T,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const key = searchParams.toString();
  // Bumped to get a new params object for the same URL (reload, or the
  // same search sent again), which makes the screen fetch once more.
  const [version, setVersion] = useState(0);

  const params = useMemo(
    () => parse(new URLSearchParams(key)),
    // `version` only forces a new object
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, parse, version],
  );

  const setParams = useCallback(
    (update: T | ((current: T) => T)) => {
      const current = parse(new URLSearchParams(key));
      const next =
        typeof update === 'function'
          ? (update as (current: T) => T)(current)
          : update;
      const nextSearch = toSearchParams(next, defaults);
      nextSearch.sort();
      const currentSearch = new URLSearchParams(key);
      currentSearch.sort();
      if (nextSearch.toString() === currentSearch.toString()) {
        setVersion((value) => value + 1);
        return;
      }
      setSearchParams(nextSearch, { replace: true });
    },
    [key, parse, defaults, setSearchParams],
  );

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return [params, setParams, reload] as const;
}
