import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { readSessionRole } from '../auth/session';
import { SiteNav } from '../navigation/SiteNav';
import type { SelectedMaterial } from '../requests/selected-materials';
import {
  buildNewRequestPath,
  buildStaffNewRequestPath,
} from '../requests/selected-materials';
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPES,
  MaterialsApiError,
  searchMaterials,
} from './api/search-materials';
import type {
  MaterialPage,
  MaterialSortField,
  MaterialType,
  SearchMaterialsParams,
  SortOrder,
} from './api/search-materials';
import styles from './MaterialSearchPage.module.css';

const PAGE_SIZE = 10;
const FORM_ID = 'material-search';

interface SearchResponse {
  params: SearchMaterialsParams;
  page: MaterialPage | null;
  error: MaterialsApiError | null;
}

const SORT_LABELS: Record<MaterialSortField, string> = {
  title: 'Título',
  catalogCode: 'Código',
  author: 'Autor',
  createdAt: 'Fecha de registro',
};

export function MaterialSearchPage() {
  const navigate = useNavigate();
  const role = readSessionRole();
  const isStaff = role === 'PERSONAL' || role === 'ADMIN';
  // Any signed-in role picks materials here: the public user requests them for
  // themselves, the staff registers the request on behalf of a visitor (HU-93).
  const canSelect = role === 'PUBLICO' || isStaff;

  const [text, setText] = useState('');
  const [collection, setCollection] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [params, setParams] = useState<SearchMaterialsParams>({
    sort: 'title',
    order: 'asc',
    page: 1,
    limit: PAGE_SIZE,
  });
  // The answer remembers which params it belongs to: while they differ, it is loading
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<SelectedMaterial[]>([]);

  useEffect(() => {
    let ignore = false;
    searchMaterials(params)
      .then((page) => {
        if (!ignore) setResponse({ params, page, error: null });
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        setResponse({
          params,
          page: null,
          error:
            caught instanceof MaterialsApiError
              ? caught
              : new MaterialsApiError(
                  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.',
                  0,
                ),
        });
      });
    return () => {
      ignore = true;
    };
  }, [params]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParams((current) => ({
      ...current,
      q: text.trim() || undefined,
      collection: collection.trim() || undefined,
      page: 1,
    }));
  }

  function changeType(type: MaterialType | '') {
    setParams((current) => ({ ...current, type: type || undefined, page: 1 }));
  }

  function changeSort(sort: MaterialSortField) {
    setParams((current) => ({ ...current, sort, page: 1 }));
  }

  function changeOrder(order: SortOrder) {
    setParams((current) => ({ ...current, order, page: 1 }));
  }

  function goToPage(page: number) {
    setParams((current) => ({ ...current, page }));
  }

  function toggle(material: SelectedMaterial) {
    setSelected((current) =>
      current.some((item) => item.id === material.id)
        ? current.filter((item) => item.id !== material.id)
        : [...current, material],
    );
  }

  function requestSelected() {
    const path = isStaff
      ? buildStaffNewRequestPath(selected.map((item) => item.id))
      : buildNewRequestPath(selected.map((item) => item.id));
    navigate(path, {
      state: { materials: selected },
    });
  }

  const isLoading = response?.params !== params;
  const result = isLoading ? null : response.page;
  const error = isLoading ? null : response.error;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <p className={styles.wordmark}>
          Trackhive<span className={styles.wordmarkDot}>.</span>
        </p>
        <p className={styles.topbarTag}>CLENA · Archivo</p>
        <SiteNav />
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="page-title">
          <p className={styles.eyebrow}>Consulta documental</p>
          <h1 id="page-title" className={styles.title}>
            Buscar material
          </h1>
          <form
            id={FORM_ID}
            className={styles.searchBar}
            onSubmit={search}
            role="search"
          >
            <label htmlFor="material-text" className="sr-only">
              Buscar
            </label>
            <input
              id="material-text"
              type="search"
              maxLength={100}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Título, autor o código"
            />
            <button className={styles.primary} type="submit">
              Buscar
            </button>
          </form>
        </section>

        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Filtros">
            <button
              type="button"
              className={styles.filtersToggle}
              aria-expanded={filtersOpen}
              aria-controls="material-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filtros {filtersOpen ? '▴' : '▾'}
            </button>

            <div
              id="material-filters"
              className={styles.filters}
              data-open={filtersOpen}
            >
              <fieldset className={styles.group}>
                <legend>Tipo</legend>
                <label className={styles.option}>
                  <input
                    type="radio"
                    name="material-type"
                    checked={!params.type}
                    onChange={() => changeType('')}
                  />
                  Todos
                </label>
                {MATERIAL_TYPES.map((value) => (
                  <label key={value} className={styles.option}>
                    <input
                      type="radio"
                      name="material-type"
                      checked={params.type === value}
                      onChange={() => changeType(value)}
                    />
                    {MATERIAL_TYPE_LABELS[value]}
                  </label>
                ))}
              </fieldset>

              <div className={styles.group}>
                <label htmlFor="material-collection">Colección o tema</label>
                <input
                  id="material-collection"
                  form={FORM_ID}
                  maxLength={120}
                  value={collection}
                  onChange={(event) => setCollection(event.target.value)}
                  placeholder="Ej.: Actas del Cabildo"
                />
                <p className={styles.hint}>Pulse Enter o «Buscar» para aplicar.</p>
              </div>
            </div>
          </aside>

          <section className={styles.results} aria-labelledby="results-title">
            <div className={styles.resultsHeader}>
              <h2 id="results-title" className={styles.sectionTitle}>
                {result ? `${result.total} resultados` : 'Resultados'}
              </h2>
              <div className={styles.sortRow}>
                <label htmlFor="material-sort">Ordenar por</label>
                <select
                  id="material-sort"
                  value={params.sort}
                  onChange={(event) =>
                    changeSort(event.target.value as MaterialSortField)
                  }
                >
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label htmlFor="material-order" className="sr-only">
                  Dirección
                </label>
                <select
                  id="material-order"
                  value={params.order}
                  onChange={(event) =>
                    changeOrder(event.target.value as SortOrder)
                  }
                >
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </select>
              </div>
            </div>

            <div aria-live="polite" aria-busy={isLoading}>
              {isLoading ? <p className={styles.muted}>Buscando…</p> : null}

              {error ? (
                <div className={styles.error} role="alert">
                  <p>
                    {error.status === 401
                      ? 'Su sesión no es válida o venció.'
                      : error.message}
                  </p>
                  {error.status === 401 ? (
                    <Link to={ROUTES.login}>Iniciar sesión</Link>
                  ) : null}
                </div>
              ) : null}

              {result && result.items.length === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>
                    No encontramos material con esa búsqueda.
                  </p>
                  <p className={styles.muted}>
                    Pruebe con otras palabras o cambie los filtros de tipo y
                    colección.
                  </p>
                </div>
              ) : null}
            </div>

            {result && result.items.length > 0 ? (
              <>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {canSelect ? (
                        <th scope="col" className={styles.checkCell}>
                          <span className="sr-only">Seleccionar</span>
                        </th>
                      ) : null}
                      <th scope="col">Título</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((material) => (
                      <tr key={material.id}>
                        {canSelect ? (
                          <td className={styles.checkCell}>
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar ${material.title}`}
                              checked={selected.some(
                                (item) => item.id === material.id,
                              )}
                              onChange={() =>
                                toggle({
                                  id: material.id,
                                  title: material.title,
                                  catalogCode: material.catalogCode,
                                })
                              }
                            />
                          </td>
                        ) : null}
                        <td className={styles.titleCell}>
                          <strong>{material.title}</strong>
                          <span className={styles.code}>
                            {material.catalogCode}
                            {material.author ? ` · ${material.author}` : ''}
                          </span>
                        </td>
                        <td data-label="Tipo">
                          {MATERIAL_TYPE_LABELS[material.materialType]}
                        </td>
                        <td data-label="Estado">
                          <span
                            className={styles.status}
                            data-status={material.status}
                          >
                            {MATERIAL_STATUS_LABELS[material.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <nav className={styles.pagination} aria-label="Paginación">
                  <button
                    type="button"
                    onClick={() => goToPage(params.page - 1)}
                    disabled={params.page <= 1}
                  >
                    ‹ Anterior
                  </button>
                  <span>
                    Página {params.page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToPage(params.page + 1)}
                    disabled={params.page >= totalPages}
                  >
                    Siguiente ›
                  </button>
                </nav>
              </>
            ) : null}
          </section>
        </div>
      </main>

      {canSelect ? (
        <div className={styles.requestBar}>
          <div className={styles.requestBarInner}>
            <p aria-live="polite">
              {selected.length === 1
                ? '1 material seleccionado'
                : `${selected.length} materiales seleccionados`}
            </p>
            <button
              className={styles.primary}
              type="button"
              onClick={requestSelected}
              disabled={selected.length === 0}
            >
              {isStaff ? 'Registrar solicitud' : 'Solicitar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
