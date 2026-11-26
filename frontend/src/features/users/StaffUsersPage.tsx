import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import { PageHeader } from '../layout/PageHeader';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import {
  networkRequestApiError,
  RequestApiError,
} from '../requests/api/request-api-error';
import {
  createStaffUser,
  EMAIL_MAX_LENGTH,
  fullName,
  listStaffUsers,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  STAFF_ROLE_LABELS,
  STAFF_ROLES,
  STAFF_USER_SORT_FIELDS,
  updateStaffUser,
} from './api/staff-users';
import {
  compact,
  readBoolean,
  readEnum,
  readPage,
  readText,
  SORT_ORDERS,
  useUrlParams,
} from '../navigation/url-params';
import { UnsavedChangesGuard } from '../navigation/UnsavedChangesGuard';
import type {
  ListStaffUsersParams,
  SortOrder,
  StaffRole,
  StaffUser,
  StaffUserPage,
  StaffUserSortField,
} from './api/staff-users';
import styles from './StaffUsersPage.module.css';

const PAGE_SIZE = 10;

const SORT_LABELS: Record<StaffUserSortField, string> = {
  lastName: 'Apellido',
  firstName: 'Nombre',
  email: 'Correo',
  role: 'Rol',
  createdAt: 'Fecha de creación',
};

const STATUS_FILTERS = [
  { value: undefined, label: 'Todas' },
  { value: true, label: 'Activas' },
  { value: false, label: 'Desactivadas' },
] as const;

const DEFAULT_PARAMS: ListStaffUsersParams = {
  sort: 'lastName',
  order: 'asc',
  page: 1,
  limit: PAGE_SIZE,
};

/** Search, filters, order and page kept in the URL, e.g. «?role=ADMIN». */
function parseParams(search: URLSearchParams): ListStaffUsersParams {
  return compact({
    q: readText(search, 'q'),
    role: readEnum(search, 'role', STAFF_ROLES),
    active: readBoolean(search, 'active'),
    sort:
      readEnum(search, 'sort', STAFF_USER_SORT_FIELDS) ?? DEFAULT_PARAMS.sort,
    order: readEnum(search, 'order', SORT_ORDERS) ?? DEFAULT_PARAMS.order,
    page: readPage(search),
    limit: PAGE_SIZE,
  });
}

interface ListResponse {
  params: ListStaffUsersParams;
  page: StaffUserPage | null;
  error: RequestApiError | null;
}

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  secondLastName: string;
  email: string;
  password: string;
}

type FormField = keyof FormState;

const EMPTY_FORM: FormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  email: '',
  password: '',
};

/** Who the form is for: a new account or an existing one. */
type Editor = { mode: 'create' } | { mode: 'edit'; user: StaffUser };

function toApiError(caught: unknown): RequestApiError {
  return caught instanceof RequestApiError ? caught : networkRequestApiError();
}

/** The message for an error the API answered, in the words of the screen. */
function errorMessage(error: RequestApiError): string {
  if (error.status === 401) {
    return 'Su sesión no es válida o venció. Inicie sesión de nuevo.';
  }
  if (error.status === 403) {
    return 'Solo un administrador puede gestionar las cuentas del personal.';
  }
  return error.message;
}

function formFromUser(user: StaffUser): FormState {
  return {
    firstName: user.firstName,
    middleName: user.middleName ?? '',
    lastName: user.lastName,
    secondLastName: user.secondLastName ?? '',
    email: user.email,
    password: '',
  };
}

/**
 * ADMIN screen (HU-05, WF-12): list the staff accounts with search, filters,
 * order and pages; create, edit, deactivate and reactivate them.
 */
export function StaffUsersPage() {
  const [params, setParams, reloadParams] = useUrlParams(
    parseParams,
    DEFAULT_PARAMS,
  );
  const [text, setText] = useState(params.q ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The answer remembers which params it belongs to: while they differ, it is loading
  const [response, setResponse] = useState<ListResponse | null>(null);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Account waiting for the administrator to confirm its deactivation
  const [confirming, setConfirming] = useState<StaffUser | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const panelTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let ignore = false;
    listStaffUsers(params)
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

  // Move the focus to the form or the confirmation when it opens
  useEffect(() => {
    if (editor || confirming) {
      panelTitle.current?.focus();
    }
  }, [editor, confirming]);

  /** Loads the same page again, so it shows the saved changes. */
  function reload() {
    reloadParams();
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParams((current) => ({ ...current, q: text.trim() || undefined, page: 1 }));
  }

  function changeRole(role: StaffRole | undefined) {
    setParams((current) => ({ ...current, role, page: 1 }));
  }

  function changeActive(active: boolean | undefined) {
    setParams((current) => ({ ...current, active, page: 1 }));
  }

  function clearFilters() {
    setText('');
    // Keeps the order and the page size: only the filters go away
    setParams((current) => ({
      sort: current.sort,
      order: current.order,
      page: 1,
      limit: current.limit,
    }));
  }

  function changeSort(sort: StaffUserSortField) {
    setParams((current) => ({ ...current, sort, page: 1 }));
  }

  function changeOrder(order: SortOrder) {
    setParams((current) => ({ ...current, order, page: 1 }));
  }

  function goToPage(page: number) {
    setParams((current) => ({ ...current, page }));
  }

  function openEditor(next: Editor) {
    setEditor(next);
    setForm(next.mode === 'edit' ? formFromUser(next.user) : EMPTY_FORM);
    setFieldErrors({});
    setFormError(null);
    setConfirming(null);
    setStatusError(null);
    setConfirmation(null);
  }

  function closeEditor() {
    setEditor(null);
    setFieldErrors({});
    setFormError(null);
  }

  function updateField(field: FormField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);

    const names = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || null,
      lastName: form.lastName.trim(),
      secondLastName: form.secondLastName.trim() || null,
    };
    try {
      if (editor.mode === 'create') {
        const created = await createStaffUser({
          ...names,
          email: form.email.trim(),
          password: form.password,
        });
        setConfirmation(
          `Se creó la cuenta de ${fullName(created)}. Ya puede iniciar ` +
            'sesión con la contraseña inicial.',
        );
      } else {
        const updated = await updateStaffUser(editor.user.id, {
          ...names,
          email: form.email.trim(),
        });
        setConfirmation(`Se guardaron los cambios de ${fullName(updated)}.`);
      }
      setEditor(null);
      reload();
    } catch (caught: unknown) {
      const error = toApiError(caught);
      const byField: Partial<Record<FormField, string>> = {};
      for (const detail of error.details) {
        if (detail.field in EMPTY_FORM) {
          byField[detail.field as FormField] = detail.messages[0];
        }
      }
      setFieldErrors(byField);
      setFormError(
        Object.keys(byField).length > 0
          ? 'Revise los campos marcados.'
          : errorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeActiveStatus(user: StaffUser, active: boolean) {
    setSaving(true);
    setStatusError(null);
    try {
      await updateStaffUser(user.id, { active });
      setConfirmation(
        `Se ${active ? 'activó' : 'desactivó'} la cuenta de ${fullName(user)}.`,
      );
      setConfirming(null);
      reload();
    } catch (caught: unknown) {
      setStatusError(errorMessage(toApiError(caught)));
    } finally {
      setSaving(false);
    }
  }

  function askDeactivation(user: StaffUser) {
    setConfirming(user);
    setStatusError(null);
    setConfirmation(null);
    setEditor(null);
  }

  const hasFilters = Boolean(
    params.q || params.role || params.active !== undefined || text,
  );
  const isLoading = response?.params !== params;
  const result = isLoading ? null : response.page;
  const error = isLoading ? null : response.error;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;

  const fieldProps = (field: FormField) => ({
    id: `staff-user-${field}`,
    value: form[field],
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field]
      ? `staff-user-${field}-error`
      : undefined,
    onChange: (event: { target: { value: string } }) =>
      updateField(field, event.target.value),
  });

  const fieldError = (field: FormField) =>
    fieldErrors[field] ? (
      <p id={`staff-user-${field}-error`} className={styles.fieldError}>
        {fieldErrors[field]}
      </p>
    ) : null;

  // The open form differs from what it started with (empty, or the account)
  const editorStart =
    editor?.mode === 'edit' ? formFromUser(editor.user) : EMPTY_FORM;
  const hasUnsavedChanges =
    editor !== null &&
    (Object.keys(EMPTY_FORM) as FormField[]).some(
      (field) => form[field] !== editorStart[field],
    );

  return (
    <AppLayout>
      <UnsavedChangesGuard when={hasUnsavedChanges} />
      <section className={searchStyles.hero} aria-labelledby="staff-users-title">
        <PageHeader
          titleId="staff-users-title"
          title="Gestión de usuarios del personal"
          description="Administre las cuentas del personal del CLENA."
        />
        <form className={searchStyles.searchBar} onSubmit={search} role="search">
          <label htmlFor="staff-user-search" className="sr-only">
            Buscar por nombre o correo
          </label>
          <input
            id="staff-user-search"
            type="search"
            maxLength={100}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Nombre o correo…"
          />
          <button className={searchStyles.primary} type="submit">
            Buscar
          </button>
        </form>
        <p className={styles.createRow}>
          <button
            type="button"
            className={`${searchStyles.primary} ${styles.createButton}`}
            onClick={() => openEditor({ mode: 'create' })}
          >
            Crear cuenta del personal
          </button>
        </p>
      </section>

      <div className={searchStyles.tableLayout}>
        <aside className={searchStyles.sidebar} aria-label="Filtros">
          <button
            type="button"
            className={searchStyles.filtersToggle}
            aria-expanded={filtersOpen}
            aria-controls="staff-user-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filtros {filtersOpen ? '▴' : '▾'}
          </button>

          <div
            id="staff-user-filters"
            className={searchStyles.filters}
            data-open={filtersOpen}
          >
            <fieldset className={searchStyles.group}>
              <legend>Rol</legend>
              <label className={searchStyles.option}>
                <input
                  type="radio"
                  name="staff-user-role"
                  checked={!params.role}
                  onChange={() => changeRole(undefined)}
                />
                Todos
              </label>
              {STAFF_ROLES.map((role) => (
                <label key={role} className={searchStyles.option}>
                  <input
                    type="radio"
                    name="staff-user-role"
                    checked={params.role === role}
                    onChange={() => changeRole(role)}
                  />
                  {STAFF_ROLE_LABELS[role]}
                </label>
              ))}
            </fieldset>

            <fieldset className={searchStyles.group}>
              <legend>Estado</legend>
              {STATUS_FILTERS.map(({ value, label }) => (
                <label key={label} className={searchStyles.option}>
                  <input
                    type="radio"
                    name="staff-user-active"
                    checked={params.active === value}
                    onChange={() => changeActive(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            {hasFilters ? (
              <button
                type="button"
                className={styles.clearButton}
                onClick={clearFilters}
              >
                Quitar filtros
              </button>
            ) : null}
          </div>
        </aside>

        <section
          className={searchStyles.results}
          aria-labelledby="staff-users-results"
        >
          <div className={searchStyles.resultsHeader}>
            <h2 id="staff-users-results" className={searchStyles.sectionTitle}>
              {result
                ? `${result.total} ${result.total === 1 ? 'cuenta' : 'cuentas'}`
                : 'Cuentas'}
            </h2>
            <div className={searchStyles.sortRow}>
              <label htmlFor="staff-user-sort">Ordenar por</label>
              <select
                id="staff-user-sort"
                value={params.sort}
                onChange={(event) =>
                  changeSort(event.target.value as StaffUserSortField)
                }
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label htmlFor="staff-user-order" className="sr-only">
                Dirección
              </label>
              <select
                id="staff-user-order"
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

          {confirmation ? (
            <p className={styles.confirmation} role="status">
              {confirmation}
            </p>
          ) : null}

          {editor ? (
            <form
              className={styles.panel}
              onSubmit={(event) => void save(event)}
              aria-labelledby="staff-user-form-title"
              noValidate
            >
              <h3
                id="staff-user-form-title"
                ref={panelTitle}
                tabIndex={-1}
                className={styles.panelTitle}
              >
                {editor.mode === 'create'
                  ? 'Crear cuenta del personal'
                  : `Editar la cuenta de ${fullName(editor.user)}`}
              </h3>

              <div className={styles.fields}>
                <div className={styles.field}>
                  <label htmlFor="staff-user-firstName">Primer nombre</label>
                  <input
                    {...fieldProps('firstName')}
                    required
                    maxLength={NAME_MAX_LENGTH}
                    autoComplete="off"
                  />
                  {fieldError('firstName')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="staff-user-middleName">
                    Segundo nombre (opcional)
                  </label>
                  <input
                    {...fieldProps('middleName')}
                    maxLength={NAME_MAX_LENGTH}
                    autoComplete="off"
                  />
                  {fieldError('middleName')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="staff-user-lastName">Primer apellido</label>
                  <input
                    {...fieldProps('lastName')}
                    required
                    maxLength={NAME_MAX_LENGTH}
                    autoComplete="off"
                  />
                  {fieldError('lastName')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="staff-user-secondLastName">
                    Segundo apellido (opcional)
                  </label>
                  <input
                    {...fieldProps('secondLastName')}
                    maxLength={NAME_MAX_LENGTH}
                    autoComplete="off"
                  />
                  {fieldError('secondLastName')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="staff-user-email">Correo</label>
                  <input
                    {...fieldProps('email')}
                    type="email"
                    required
                    maxLength={EMAIL_MAX_LENGTH}
                    autoComplete="off"
                  />
                  {fieldError('email')}
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Rol</span>
                  <p className={styles.fixedValue}>
                    {STAFF_ROLE_LABELS[
                      editor.mode === 'edit' ? editor.user.role : 'PERSONAL'
                    ]}
                  </p>
                  <p className={styles.hint}>
                    {editor.mode === 'create'
                      ? 'Las cuentas nuevas siempre se crean con rol Personal.'
                      : 'El rol no se puede cambiar.'}
                  </p>
                </div>
                {editor.mode === 'create' ? (
                  <div className={styles.field}>
                    <label htmlFor="staff-user-password">
                      Contraseña inicial
                    </label>
                    <input
                      {...fieldProps('password')}
                      type="password"
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      maxLength={PASSWORD_MAX_LENGTH}
                      autoComplete="new-password"
                      aria-describedby={[
                        'staff-user-password-hint',
                        fieldErrors.password ? 'staff-user-password-error' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                    <p id="staff-user-password-hint" className={styles.hint}>
                      Mínimo {PASSWORD_MIN_LENGTH} caracteres. Entréguela a la
                      persona por un canal seguro.
                    </p>
                    {fieldError('password')}
                  </div>
                ) : null}
              </div>

              {formError ? (
                <p className={searchStyles.error} role="alert">
                  {formError}
                </p>
              ) : null}

              <div className={styles.actions}>
                <button
                  className={searchStyles.primary}
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Guardando…'
                    : editor.mode === 'create'
                      ? 'Crear cuenta'
                      : 'Guardar cambios'}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={closeEditor}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          {confirming ? (
            <section
              className={styles.panel}
              aria-labelledby="staff-user-confirm-title"
            >
              <h3
                id="staff-user-confirm-title"
                ref={panelTitle}
                tabIndex={-1}
                className={styles.panelTitle}
              >
                ¿Desactivar la cuenta de {fullName(confirming)}?
              </h3>
              <p className={styles.panelText}>
                No podrá iniciar sesión ni renovar su sesión. Sus solicitudes y
                el historial que registró se conservan, y puede activar la
                cuenta de nuevo cuando quiera.
              </p>
              {statusError ? (
                <p className={searchStyles.error} role="alert">
                  {statusError}
                </p>
              ) : null}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => void changeActiveStatus(confirming, false)}
                  disabled={saving}
                >
                  {saving ? 'Desactivando…' : 'Desactivar cuenta'}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setConfirming(null)}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </div>
            </section>
          ) : null}

          {!confirming && statusError ? (
            <p className={searchStyles.error} role="alert">
              {statusError}
            </p>
          ) : null}

          <div aria-live="polite" aria-busy={isLoading}>
            {isLoading ? (
              <p className={searchStyles.muted}>Cargando…</p>
            ) : null}

            {error ? (
              <div className={searchStyles.error} role="alert">
                <p>{errorMessage(error)}</p>
                {error.status === 401 ? (
                  <Link to={ROUTES.login}>Iniciar sesión</Link>
                ) : null}
              </div>
            ) : null}

            {result && result.items.length === 0 ? (
              <div className={searchStyles.empty}>
                <p className={searchStyles.emptyTitle}>
                  No encontramos cuentas con esos filtros.
                </p>
                <p className={searchStyles.muted}>
                  Pruebe con otro texto o quite algún filtro.
                </p>
              </div>
            ) : null}
          </div>

          {result && result.items.length > 0 ? (
            <>
              <table className={searchStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((user) => {
                    const name = fullName(user);
                    return (
                      <tr key={user.id}>
                        <td className={searchStyles.titleCell}>
                          <strong>{name}</strong>
                        </td>
                        <td data-label="Correo" className={styles.email}>
                          {user.email}
                        </td>
                        <td data-label="Rol">{STAFF_ROLE_LABELS[user.role]}</td>
                        <td data-label="Estado">
                          <span
                            className={styles.badge}
                            data-active={user.active}
                          >
                            {user.active ? 'Activa' : 'Desactivada'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.secondary}
                              onClick={() =>
                                openEditor({ mode: 'edit', user })
                              }
                              aria-label={`Editar la cuenta de ${name}`}
                            >
                              Editar
                            </button>
                            {user.active ? (
                              <button
                                type="button"
                                className={styles.secondary}
                                onClick={() => askDeactivation(user)}
                                aria-label={`Desactivar la cuenta de ${name}`}
                              >
                                Desactivar
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.secondary}
                                onClick={() =>
                                  void changeActiveStatus(user, true)
                                }
                                disabled={saving}
                                aria-label={`Activar la cuenta de ${name}`}
                              >
                                Activar
                              </button>
                            )}
                          </div>
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
      </div>
    </AppLayout>
  );
}
