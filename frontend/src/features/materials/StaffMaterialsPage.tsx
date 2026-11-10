import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import {
  changeMaterialStatus,
  MAX_STATUS_REASON_LENGTH,
} from './api/change-material-status';
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_STATUSES,
  MATERIAL_TYPE_LABELS,
  MaterialsApiError,
  searchMaterials,
} from './api/search-materials';
import type {
  Material,
  MaterialPage,
  MaterialStatus,
  SearchMaterialsParams,
} from './api/search-materials';
import searchStyles from './MaterialSearchPage.module.css';
import styles from './StaffMaterialsPage.module.css';

const PAGE_SIZE = 10;
const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

interface SearchResponse {
  params: SearchMaterialsParams;
  page: MaterialPage | null;
  error: MaterialsApiError | null;
}

function toApiError(caught: unknown): MaterialsApiError {
  return caught instanceof MaterialsApiError
    ? caught
    : new MaterialsApiError(NETWORK_ERROR_MESSAGE, 0);
}

/** Staff screen (HU-08): list the material and change its availability status. */
export function StaffMaterialsPage() {
  const [text, setText] = useState('');
  const [params, setParams] = useState<SearchMaterialsParams>({
    sort: 'title',
    order: 'asc',
    page: 1,
    limit: PAGE_SIZE,
  });
  // The answer remembers which params it belongs to: while they differ, it is loading
  const [response, setResponse] = useState<SearchResponse | null>(null);
  // Statuses already saved in this session, so the list shows them without a new search
  const [savedStatuses, setSavedStatuses] = useState<
    Record<string, MaterialStatus>
  >({});

  const [editing, setEditing] = useState<Material | null>(null);
  const [newStatus, setNewStatus] = useState<MaterialStatus>('DISPONIBLE');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    searchMaterials(params)
      .then((page) => {
        if (!ignore) setResponse({ params, page, error: null });
      })
      .catch((caught: unknown) => {
        if (!ignore)
          setResponse({ params, page: null, error: toApiError(caught) });
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
      page: 1,
    }));
  }

  function goToPage(page: number) {
    setParams((current) => ({ ...current, page }));
  }

  function startEditing(material: Material) {
    setEditing(material);
    setNewStatus(savedStatuses[material.id] ?? material.status);
    setReason('');
    setSaveError(null);
    setConfirmation(null);
  }

  function cancelEditing() {
    setEditing(null);
    setSaveError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await changeMaterialStatus({
        materialId: editing.id,
        status: newStatus,
        reason: reason.trim() || undefined,
      });
      setSavedStatuses((current) => ({
        ...current,
        [editing.id]: updated.status,
      }));
      setConfirmation(
        `«${editing.title}» ahora está ${MATERIAL_STATUS_LABELS[updated.status].toLowerCase()}.`,
      );
      setEditing(null);
    } catch (caught: unknown) {
      const error = toApiError(caught);
      setSaveError(
        error.status === 401
          ? 'Su sesión no es válida o venció. Inicie sesión de nuevo.'
          : error.status === 403
            ? 'No tiene permiso para cambiar el estado del material.'
            : error.message,
      );
    } finally {
      setSaving(false);
    }
  }

  const isLoading = response?.params !== params;
  const result = isLoading ? null : response.page;
  const error = isLoading ? null : response.error;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;

  return (
    <div className={searchStyles.shell}>
      <header className={searchStyles.topbar}>
        <p className={searchStyles.wordmark}>
          Trackhive<span className={searchStyles.wordmarkDot}>.</span>
        </p>
        <p className={searchStyles.topbarTag}>CLENA · Personal</p>
      </header>

      <main className={searchStyles.main}>
        <section className={searchStyles.hero} aria-labelledby="staff-title">
          <p className={searchStyles.eyebrow}>Gestión del archivo</p>
          <h1 id="staff-title" className={searchStyles.title}>
            Estado del material
          </h1>
          <form
            className={searchStyles.searchBar}
            onSubmit={search}
            role="search"
          >
            <label htmlFor="staff-material-text" className="sr-only">
              Buscar
            </label>
            <input
              id="staff-material-text"
              type="search"
              maxLength={100}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Título, autor o código"
            />
            <button className={searchStyles.primary} type="submit">
              Buscar
            </button>
          </form>
        </section>

        <section
          className={searchStyles.results}
          aria-labelledby="staff-results"
        >
          <h2 id="staff-results" className={searchStyles.sectionTitle}>
            {result ? `${result.total} materiales` : 'Materiales'}
          </h2>

          {confirmation ? (
            <p className={styles.confirmation} role="status">
              {confirmation}
            </p>
          ) : null}

          {editing ? (
            <form
              className={styles.editor}
              onSubmit={(event) => void save(event)}
              aria-labelledby="editor-title"
            >
              <h3 id="editor-title" className={styles.editorTitle}>
                Cambiar estado de «{editing.title}»
              </h3>
              <p className={searchStyles.code}>{editing.catalogCode}</p>

              <div className={styles.field}>
                <label htmlFor="material-new-status">Estado</label>
                <select
                  id="material-new-status"
                  value={newStatus}
                  onChange={(event) =>
                    setNewStatus(event.target.value as MaterialStatus)
                  }
                >
                  {MATERIAL_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {MATERIAL_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="material-status-reason">
                  Motivo (opcional)
                </label>
                <textarea
                  id="material-status-reason"
                  rows={3}
                  maxLength={MAX_STATUS_REASON_LENGTH}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>

              {saveError ? (
                <p className={searchStyles.error} role="alert">
                  {saveError}
                </p>
              ) : null}

              <div className={styles.actions}>
                <button
                  className={searchStyles.primary}
                  type="submit"
                  disabled={saving}
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" onClick={cancelEditing} disabled={saving}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          <div aria-live="polite" aria-busy={isLoading}>
            {isLoading ? <p className={searchStyles.muted}>Buscando…</p> : null}

            {error ? (
              <div className={searchStyles.error} role="alert">
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
              <div className={searchStyles.empty}>
                <p className={searchStyles.emptyTitle}>
                  No encontramos material con esa búsqueda.
                </p>
              </div>
            ) : null}
          </div>

          {result && result.items.length > 0 ? (
            <>
              <table className={searchStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Título</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((material) => {
                    const status =
                      savedStatuses[material.id] ?? material.status;
                    return (
                      <tr key={material.id}>
                        <td className={searchStyles.titleCell}>
                          <strong>{material.title}</strong>
                          <span className={searchStyles.code}>
                            {material.catalogCode}
                            {material.author ? ` · ${material.author}` : ''}
                          </span>
                        </td>
                        <td data-label="Tipo">
                          {MATERIAL_TYPE_LABELS[material.materialType]}
                        </td>
                        <td data-label="Estado">
                          <span
                            className={searchStyles.status}
                            data-status={status}
                          >
                            {MATERIAL_STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.changeButton}
                            onClick={() => startEditing(material)}
                            aria-label={`Cambiar estado de ${material.title}`}
                          >
                            Cambiar estado
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <nav className={searchStyles.pagination} aria-label="Paginación">
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
      </main>
    </div>
  );
}
