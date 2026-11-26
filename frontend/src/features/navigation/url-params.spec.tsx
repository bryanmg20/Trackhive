import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  compact,
  readBoolean,
  readDate,
  readEnum,
  readPage,
  readText,
  toSearchParams,
  useUrlParams,
} from './url-params';

interface Params {
  q?: string;
  status?: 'OPEN' | 'CLOSED';
  active?: boolean;
  from?: string;
  sort: 'name' | 'date';
  page: number;
  limit: number;
}

const DEFAULTS: Params = { sort: 'name', page: 1, limit: 10 };

function parse(search: URLSearchParams): Params {
  return compact({
    q: readText(search, 'q'),
    status: readEnum(search, 'status', ['OPEN', 'CLOSED'] as const),
    active: readBoolean(search, 'active'),
    from: readDate(search, 'from'),
    sort: readEnum(search, 'sort', ['name', 'date'] as const) ?? 'name',
    page: readPage(search),
    limit: 10,
  });
}

describe('url-params readers', () => {
  it('reads only valid values and falls back to the defaults', () => {
    const search = new URLSearchParams(
      'q=%20acta%20&status=NOPE&active=true&from=20-11-2026&sort=date&page=-3',
    );

    expect(parse(search)).toEqual({
      q: 'acta',
      active: true,
      sort: 'date',
      page: 1,
      limit: 10,
    });
  });

  it('writes a clean query string without defaults or the page size', () => {
    const search = toSearchParams<Params>(
      { q: 'acta', status: 'OPEN', active: false, sort: 'name', page: 1, limit: 10 },
      DEFAULTS,
    );

    expect(search.toString()).toBe('q=acta&status=OPEN&active=false');
  });
});

// What the probe hands to the test after each render (set in an effect)
const probe: { current: ReturnType<typeof useUrlParams<Params>> | null } = {
  current: null,
};

function Probe() {
  const api = useUrlParams(parse, DEFAULTS);
  const location = useLocation();
  useEffect(() => {
    probe.current = api;
  });
  return <p data-testid="search">{location.search}</p>;
}

function current() {
  if (!probe.current) throw new Error('Probe not rendered');
  return probe.current;
}

describe('useUrlParams', () => {
  it('starts from the URL and keeps every change in it', () => {
    render(
      <MemoryRouter initialEntries={['/lista?status=CLOSED&page=3']}>
        <Probe />
      </MemoryRouter>,
    );

    expect(current()[0]).toEqual({
      status: 'CLOSED',
      sort: 'name',
      page: 3,
      limit: 10,
    });

    act(() => current()[1]((params) => ({ ...params, q: 'acta', page: 1 })));

    // Keys come out sorted, so the same search always has the same URL
    expect(screen.getByTestId('search')).toHaveTextContent(
      '?q=acta&status=CLOSED',
    );
    expect(current()[0]).toMatchObject({ q: 'acta', page: 1 });
  });

  it('gives a new params object on reload so the screen fetches again', () => {
    render(
      <MemoryRouter initialEntries={['/lista']}>
        <Probe />
      </MemoryRouter>,
    );
    const before = current()[0];

    act(() => current()[2]());

    expect(current()[0]).not.toBe(before);
    expect(current()[0]).toEqual(before);
  });
});
