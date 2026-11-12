import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestDetailPath, ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import { MATERIAL_TYPE_LABELS } from '../materials/api/search-materials';
import type { MaterialType } from '../materials/api/search-materials';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
  listAppointments,
} from './api/list-appointments';
import type {
  AppointmentListItem,
  AppointmentPage,
  AppointmentSortField,
  AppointmentStatus,
  ListAppointmentsParams,
} from './api/list-appointments';
import {
  REQUEST_STATUS_LABELS,
  RequestsApiError,
} from './api/list-requests';
import type { SortOrder } from './api/list-requests';
import styles from './AppointmentsCalendarPage.module.css';
import listStyles from './RequestsListPage.module.css';

const PAGE_SIZE = 20;
const FORM_ID = 'appointment-search';
const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

const SORT_LABELS: Record<AppointmentSortField, string> = {
  appointmentDate: 'Fecha de la cita',
  createdAt: 'Fecha de registro',
};

const REQUESTER_TYPE_LABELS: Record<string, string> = {
  INVESTIGADOR: 'Investigador',
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  CIUDADANO: 'Ciudadano',
  ENTIDAD: 'Entidad',
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

const MONTH_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

const FULL_DAY_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
});

interface YearMonth {
  year: number;
  month: number; // 1..12
}

interface CalendarDay {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSunday: boolean;
}

interface ListResponse {
  params: ListAppointmentsParams;
  page: AppointmentPage | null;
  error: RequestsApiError | null;
}

/** "2026-11-20" -> "20/11/2026". Date-only text: no time zone conversion. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** "2026-11-20" -> "viernes 20/11/2026". */
function formatFullDay(isoDate: string): string {
  const weekday = FULL_DAY_FORMAT.format(
    new Date(`${isoDate.slice(0, 10)}T12:00:00Z`),
  );
  return `${weekday} ${formatDate(isoDate)}`;
}

/** "08:00" -> "8:00". */
function formatHour(time: string): string {
  return time.replace(/^0/, '');
}

function parseYearMonth(isoDate: string): YearMonth {
  const [year, month] = isoDate.slice(0, 10).split('-').map(Number);
  return { year, month };
}

function currentBogotaYearMonth(): YearMonth {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 2026);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 11);
  return { year, month };
}

function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

function formatMonthTitle({ year, month }: YearMonth): string {
  return MONTH_FORMAT.format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Builds the Monday-to-Sunday calendar cells of a given month. */
function buildCalendarDays({ year, month }: YearMonth): CalendarDay[] {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: CalendarDay[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(Date.UTC(year, month - 1, 1 - startOffset + i));
    const cellYear = cellDate.getUTCFullYear();
    const cellMonth = cellDate.getUTCMonth() + 1;
    const cellDay = cellDate.getUTCDate();
    cells.push({
      isoDate: toIsoDate(cellYear, cellMonth, cellDay),
      dayNumber: cellDay,
      inCurrentMonth: cellYear === year && cellMonth === month,
      isSunday: cellDate.getUTCDay() === 0,
    });
  }
  return cells;
}

interface AppointmentCardButtonProps {
  item: AppointmentListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}

function AppointmentCardButton({
  item,
  selected,
  onSelect,
}: AppointmentCardButtonProps) {
  const materialSummary = item.materials.map((m) => m.title).join(', ');
  return (
    <button
      type="button"
      className={styles.eventButton}
      aria-pressed={selected}
      onClick={() => onSelect(item.id)}
    >
      <span className={styles.eventDate}>
        {formatDate(item.date)} · {item.request.trackingCode}
      </span>
      <span className={styles.eventMaterial}>{materialSummary}</span>
      <span className={styles.eventRequester}>{item.requester.name}</span>
      <span className={styles.badge} data-status={item.status}>
        {APPOINTMENT_STATUS_LABELS[item.status]}
      </span>
    </button>
  );
}

/**
 * Staff screen (HU-19): calendar of scheduled appointments with filters by
 * material or requester, pagination, ordering and appointment detail view.
 */
export function AppointmentsCalendarPage() {
  const [requester, setRequester] = useState('');
  const [material, setMaterial] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [manualMonth, setManualMonth] = useState<YearMonth | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<ListAppointmentsParams>({
    sort: 'appointmentDate',
    order: 'asc',
    page: 1,
    limit: PAGE_SIZE,
  });
  const [response, setResponse] = useState<ListResponse | null>(null);

  useEffect(() => {
    let ignore = false;
    listAppointments(params)
      .then((page) => {
        if (!ignore) setResponse({ params, page, error: null });
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        setResponse({
          params,
          page: null,
          error:
            caught instanceof RequestsApiError
              ? caught
              : new RequestsApiError(NETWORK_ERROR_MESSAGE, 0),
        });
      });
    return () => {
      ignore = true;
    };
  }, [params]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualMonth(null);
    setParams((current) => ({
      ...current,
      requester: requester.trim() || undefined,
      material: material.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      page: 1,
    }));
  }

  function changeStatus(status: AppointmentStatus | '') {
    setManualMonth(null);
    setParams((current) => ({
      ...current,
      status: status || undefined,
      page: 1,
    }));
  }

  function changeDate(field: 'from' | 'to', value: string) {
    if (field === 'from') setFrom(value);
    else setTo(value);
    setManualMonth(null);
    setParams((current) => ({
      ...current,
      [field]: value || undefined,
      page: 1,
    }));
  }

  function clearFilters() {
    setRequester('');
    setMaterial('');
    setFrom('');
    setTo('');
    setManualMonth(null);
    setParams((current) => ({
      sort: current.sort,
      order: current.order,
      page: 1,
      limit: current.limit,
    }));
  }

  function changeSort(sort: AppointmentSortField) {
    setParams((current) => ({ ...current, sort, page: 1 }));
  }

  function changeOrder(order: SortOrder) {
    setParams((current) => ({ ...current, order, page: 1 }));
  }

  function goToPage(page: number) {
    setParams((current) => ({ ...current, page }));
  }

  const hasFilters = Boolean(
    params.status ||
      params.from ||
      params.to ||
      params.requester ||
      params.material ||
      requester ||
      material,
  );
  const isLoading = response?.params !== params;
  const result = isLoading ? null : response.page;
  const error = isLoading ? null : response.error;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;

  // Defaults to the month of the first appointment in the page, or Bogota's current month
  const activeMonth: YearMonth =
    manualMonth ??
    (result && result.items.length > 0
      ? parseYearMonth(result.items[0].date)
      : currentBogotaYearMonth());

  const calendarDays = buildCalendarDays(activeMonth);
  const appointmentsByDate = new Map<string, AppointmentListItem[]>();
  for (const item of result?.items ?? []) {
    const key = item.date.slice(0, 10);
    const list = appointmentsByDate.get(key) ?? [];
    list.push(item);
    appointmentsByDate.set(key, list);
  }

  const visibleDates = new Set(calendarDays.map((day) => day.isoDate));
  const otherMonthItems = (result?.items ?? []).filter(
    (item) => !visibleDates.has(item.date.slice(0, 10)),
  );

  const selectedAppointment =
    (result?.items ?? []).find((item) => item.id === selectedId) ?? null;

  return (
    <AppLayout>
      <section className={searchStyles.hero} aria-labelledby="calendar-title">
        <p className={searchStyles.eyebrow}>Agenda de sala de lectura</p>
        <h1 id="calendar-title" className={searchStyles.title}>
          Calendario de citas
        </h1>
        <form
          id={FORM_ID}
          className={searchStyles.searchBar}
          onSubmit={search}
          role="search"
        >
          <label htmlFor="appointment-requester" className="sr-only">
            Solicitante
          </label>
          <input
            id="appointment-requester"
            type="search"
            maxLength={100}
            value={requester}
            onChange={(event) => setRequester(event.target.value)}
            placeholder="Solicitante: nombre, correo o documento"
          />
          <button className={searchStyles.primary} type="submit">
            Buscar
          </button>
        </form>
      </section>

      <div className={searchStyles.layout}>
        <aside className={searchStyles.sidebar} aria-label="Filtros">
          <button
            type="button"
            className={searchStyles.filtersToggle}
            aria-expanded={filtersOpen}
            aria-controls="appointment-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filtros {filtersOpen ? '▴' : '▾'}
          </button>

          <div
            id="appointment-filters"
            className={searchStyles.filters}
            data-open={filtersOpen}
          >
            <fieldset className={searchStyles.group}>
              <legend>Estado</legend>
              <label className={searchStyles.option}>
                <input
                  type="radio"
                  name="appointment-status"
                  checked={!params.status}
                  onChange={() => changeStatus('')}
                />
                Todas
              </label>
              {APPOINTMENT_STATUSES.map((value) => (
                <label key={value} className={searchStyles.option}>
                  <input
                    type="radio"
                    name="appointment-status"
                    checked={params.status === value}
                    onChange={() => changeStatus(value)}
                  />
                  {APPOINTMENT_STATUS_LABELS[value]}
                </label>
              ))}
            </fieldset>

            <div className={searchStyles.group}>
              <label htmlFor="appointment-material">Material</label>
              <input
                id="appointment-material"
                form={FORM_ID}
                maxLength={100}
                value={material}
                onChange={(event) => setMaterial(event.target.value)}
                placeholder="Título o código"
              />
              <p className={searchStyles.hint}>
                Pulse Enter o «Buscar» para aplicar.
              </p>
            </div>

            <div className={`${searchStyles.group} ${listStyles.dates}`}>
              <label htmlFor="appointment-from">Fecha desde</label>
              <input
                id="appointment-from"
                form={FORM_ID}
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => changeDate('from', event.target.value)}
              />
              <label htmlFor="appointment-to">Fecha hasta</label>
              <input
                id="appointment-to"
                form={FORM_ID}
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => changeDate('to', event.target.value)}
              />
            </div>

            {hasFilters ? (
              <button
                type="button"
                className={listStyles.clearButton}
                onClick={clearFilters}
              >
                Quitar filtros
              </button>
            ) : null}
          </div>
        </aside>

        <section
          className={searchStyles.results}
          aria-labelledby="appointments-results"
        >
          <div className={searchStyles.resultsHeader}>
            <h2
              id="appointments-results"
              className={searchStyles.sectionTitle}
            >
              {result ? `${result.total} citas` : 'Citas'}
            </h2>
            <div className={searchStyles.sortRow}>
              <label htmlFor="appointment-sort">Ordenar por</label>
              <select
                id="appointment-sort"
                value={params.sort}
                onChange={(event) =>
                  changeSort(event.target.value as AppointmentSortField)
                }
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label htmlFor="appointment-order" className="sr-only">
                Dirección
              </label>
              <select
                id="appointment-order"
                value={params.order}
                onChange={(event) =>
                  changeOrder(event.target.value as SortOrder)
                }
              >
                <option value="asc">Más próximas primero</option>
                <option value="desc">Más recientes primero</option>
              </select>
            </div>
          </div>

          <div className={styles.calendarToolbar}>
            <div className={styles.monthNav}>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => setManualMonth(shiftMonth(activeMonth, -1))}
              >
                ‹ Mes anterior
              </button>
              <span className={styles.monthTitle} aria-live="polite">
                {formatMonthTitle(activeMonth)}
              </span>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => setManualMonth(shiftMonth(activeMonth, 1))}
              >
                Mes siguiente ›
              </button>
            </div>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => setManualMonth(currentBogotaYearMonth())}
            >
              Mes actual
            </button>
          </div>

          <div aria-live="polite" aria-busy={isLoading}>
            {isLoading ? (
              <p className={searchStyles.muted}>Cargando…</p>
            ) : null}

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
                  No encontramos citas con esos filtros.
                </p>
                <p className={searchStyles.muted}>
                  Pruebe con otros filtros o quite alguno.
                </p>
              </div>
            ) : null}
          </div>

          {result && result.items.length > 0 ? (
            <>
              <div
                className={styles.calendarGrid}
                role="region"
                aria-label={`Calendario de ${formatMonthTitle(activeMonth)}`}
              >
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className={styles.weekdayHeader}>
                    {weekday}
                  </div>
                ))}
                {calendarDays.map((day) => {
                  const dayItems = appointmentsByDate.get(day.isoDate) ?? [];
                  return (
                    <div
                      key={day.isoDate}
                      data-date={day.isoDate}
                      className={[
                        styles.dayCell,
                        !day.inCurrentMonth ? styles.dayOutside : '',
                        day.isSunday ? styles.daySunday : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className={styles.dayHeader}>
                        <span className={styles.dayNumber}>
                          {day.dayNumber}
                        </span>
                        {day.isSunday ? (
                          <span className={styles.sundayTag}>Cerrado</span>
                        ) : null}
                      </div>
                      {dayItems.length > 0 ? (
                        <ul className={styles.dayEvents}>
                          {dayItems.map((item) => (
                            <li key={item.id}>
                              <AppointmentCardButton
                                item={item}
                                selected={selectedId === item.id}
                                onSelect={setSelectedId}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {otherMonthItems.length > 0 ? (
                <div className={styles.agendaSection}>
                  <h3 className={searchStyles.sectionTitle}>
                    Citas en otros meses de esta página
                  </h3>
                  <ul className={styles.agendaList}>
                    {otherMonthItems.map((item) => (
                      <li key={item.id}>
                        <AppointmentCardButton
                          item={item}
                          selected={selectedId === item.id}
                          onSelect={setSelectedId}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {selectedAppointment ? (
                <section
                  className={styles.detailCard}
                  aria-labelledby="appointment-detail-title"
                >
                  <div className={styles.detailHeader}>
                    <div className={styles.detailTitleGroup}>
                      <h3
                        id="appointment-detail-title"
                        className={styles.detailTitle}
                      >
                        Detalle de la cita ·{' '}
                        {selectedAppointment.request.trackingCode}
                      </h3>
                      <span
                        className={styles.badge}
                        data-status={selectedAppointment.status}
                      >
                        {
                          APPOINTMENT_STATUS_LABELS[
                            selectedAppointment.status
                          ]
                        }
                      </span>
                    </div>
                    <Link
                      className={listStyles.shortcut}
                      to={requestDetailPath(selectedAppointment.request.id)}
                    >
                      Ver solicitud completa ›
                    </Link>
                  </div>

                  <dl className={styles.detailGrid}>
                    <div className={styles.detailField}>
                      <dt>Fecha de la cita</dt>
                      <dd>{formatFullDay(selectedAppointment.date)}</dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Horario de atención</dt>
                      <dd>
                        De{' '}
                        {formatHour(
                          selectedAppointment.serviceHours.opensAt,
                        )}{' '}
                        a{' '}
                        {formatHour(
                          selectedAppointment.serviceHours.closesAt,
                        )}
                      </dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Estado de la solicitud</dt>
                      <dd>
                        {
                          REQUEST_STATUS_LABELS[
                            selectedAppointment.request.status
                          ]
                        }
                      </dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Solicitante</dt>
                      <dd>{selectedAppointment.requester.name}</dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Correo</dt>
                      <dd>
                        {selectedAppointment.requester.email || 'No indica'}
                      </dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Teléfono</dt>
                      <dd>
                        {selectedAppointment.requester.phone || 'No indica'}
                      </dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Tipo de solicitante</dt>
                      <dd>
                        {REQUESTER_TYPE_LABELS[
                          selectedAppointment.requester.requesterType
                        ] ?? selectedAppointment.requester.requesterType}
                      </dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Institución</dt>
                      <dd>
                        {selectedAppointment.requester.institution ||
                          'No indica'}
                      </dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Documento</dt>
                      <dd>
                        {selectedAppointment.requester.documentNumber
                          ? `${selectedAppointment.requester.documentType ?? ''} ${selectedAppointment.requester.documentNumber}`.trim()
                          : 'No indica'}
                      </dd>
                    </div>
                    <div className={styles.detailField}>
                      <dt>Agendada por</dt>
                      <dd>{selectedAppointment.scheduledBy.name}</dd>
                    </div>
                    {selectedAppointment.notes ? (
                      <div className={styles.detailField}>
                        <dt>Notas</dt>
                        <dd>{selectedAppointment.notes}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div>
                    <p className={styles.detailMaterialsTitle}>
                      Material reservado para la cita
                    </p>
                    <ul className={styles.detailMaterials}>
                      {selectedAppointment.materials.map((materialItem) => (
                        <li
                          key={materialItem.id}
                          className={styles.detailMaterialItem}
                        >
                          <strong>{materialItem.title}</strong>
                          <span className={styles.detailMeta}>
                            {materialItem.catalogCode} ·{' '}
                            {MATERIAL_TYPE_LABELS[
                              materialItem.materialType as MaterialType
                            ] ?? materialItem.materialType}
                          </span>
                          <span className={styles.detailMeta}>
                            Ubicación: {materialItem.location.depot} ·{' '}
                            {materialItem.location.shelf} ·{' '}
                            {materialItem.location.box}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ) : null}

              <nav
                className={searchStyles.pagination}
                aria-label="Paginación"
              >
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
