import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestDetailPath, ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import { PageHeader } from '../layout/PageHeader';
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_TYPE_LABELS,
  MaterialsApiError,
} from '../materials/api/search-materials';
import type { MaterialType } from '../materials/api/search-materials';
import {
  deliverAppointmentMaterial,
  formatBogotaDateTime,
  returnMaterial,
  todayInBogotaIso,
} from '../materials/api/material-loans';
import type {
  AppointmentMaterialLoanSummary,
  MaterialLoanRecord,
} from '../materials/api/material-loans';
import { LoanActionModal } from '../materials/LoanActionModal';
import type { LoanActionMode } from '../materials/LoanActionModal';
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
import { REQUEST_STATUS_LABELS, RequestsApiError } from './api/list-requests';
import type { SortOrder } from './api/list-requests';
import { getRoomOccupancy } from './api/room-capacity';
import type { RoomOccupancy } from './api/room-capacity';
import {
  cancelAppointment,
  rescheduleAppointment,
} from './api/manage-appointment';
import styles from './AppointmentsCalendarPage.module.css';
import { listCalendarMonth } from './api/list-calendar-month';
import listStyles from './RequestsListPage.module.css';

const PAGE_SIZE = 20;
const DAILY_CAPACITY = 15;
const PREVIEW_COUNT = 3;
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

/** «noviembre de 2026» → «Noviembre de 2026» (only the first letter). */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es-CO') + text.slice(1);
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
      aria-label={`${formatDate(item.date)} · ${item.request.trackingCode} · ${materialSummary} · ${item.requester.name} · ${APPOINTMENT_STATUS_LABELS[item.status]}`}
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [monthAttempt, setMonthAttempt] = useState(0);
  const [occupancyAttempt, setOccupancyAttempt] = useState(0);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Cancelling frees the material and notifies the requester: it takes a
  // second, explicit step («Sí, cancelar cita») after «Cancelar cita».
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const cancelQuestion = useRef<HTMLParagraphElement>(null);
  const returnFocusToCancel = useRef(false);
  const [loanDialog, setLoanDialog] = useState<{
    mode: LoanActionMode;
    appointment: AppointmentListItem;
    material: AppointmentListItem['materials'][number];
  } | null>(null);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    message: string;
    sessionExpired: boolean;
  } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [patchedById, setPatchedById] = useState<
    Record<string, Partial<AppointmentListItem>>
  >({});
  const dayDialog = useRef<HTMLDialogElement>(null);
  const [monthResponse, setMonthResponse] = useState<{
    key: string;
    data?: Awaited<ReturnType<typeof listCalendarMonth>>;
    error?: string;
  } | null>(null);
  const [occupancyState, setOccupancyState] = useState<{
    rangeKey: string;
    data: RoomOccupancy;
  } | null>(null);
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
  const firstVisibleDate = calendarDays[0]?.isoDate ?? '';
  const lastVisibleDate = calendarDays[calendarDays.length - 1]?.isoDate ?? '';
  const occupancyRangeKey = `${firstVisibleDate}:${lastVisibleDate}`;
  const monthFrom = calendarDays[0].isoDate;
  const monthTo = calendarDays[calendarDays.length - 1].isoDate;
  const monthKey = JSON.stringify({ params, monthFrom, monthTo });

  useEffect(() => {
    if (isLoading || !result) return;
    let ignore = false;
    const query = JSON.parse(monthKey) as {
      params: ListAppointmentsParams;
      monthFrom: string;
      monthTo: string;
    };
    listCalendarMonth(query.params, query.monthFrom, query.monthTo)
      .then((data) => {
        if (!ignore) setMonthResponse({ key: monthKey, data });
      })
      .catch(() => {
        if (!ignore)
          setMonthResponse({
            key: monthKey,
            error: 'No pudimos cargar la agenda completa. Inténtelo de nuevo.',
          });
      });
    return () => {
      ignore = true;
    };
  }, [monthKey, isLoading, result, monthAttempt]);

  useEffect(() => {
    const dialog = dayDialog.current;
    if (!expandedDate || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [expandedDate]);

  /**
   * Opens the full agenda of a day. Escape closes the <dialog> at once but
   * its «close» event arrives later; if the same day is asked for again in
   * between, the state still holds it, so the dialog is reopened directly.
   */
  const openDayAgenda = (isoDate: string) => {
    const dialog = dayDialog.current;
    if (expandedDate === isoDate && dialog && !dialog.open) {
      dialog.showModal();
      return;
    }
    setExpandedDate(isoDate);
  };

  useEffect(() => {
    if (!firstVisibleDate || !lastVisibleDate) return;
    let ignore = false;
    getRoomOccupancy(firstVisibleDate, lastVisibleDate)
      .then((data) => {
        if (!ignore) {
          setOccupancyState({
            rangeKey: occupancyRangeKey,
            data,
          });
        }
      })
      .catch(() => {
        if (!ignore) setOccupancyState(null);
      });
    return () => {
      ignore = true;
    };
  }, [firstVisibleDate, lastVisibleDate, occupancyRangeKey, occupancyAttempt]);

  useEffect(() => {
    if (confirmingCancel) {
      cancelQuestion.current?.focus();
    } else if (returnFocusToCancel.current) {
      returnFocusToCancel.current = false;
      cancelTrigger.current?.focus();
    }
  }, [confirmingCancel]);

  function keepAppointment() {
    returnFocusToCancel.current = true;
    setConfirmingCancel(false);
  }

  function selectAppointment(id: string) {
    setSelectedId(id);
    setConfirmingCancel(false);
    setRescheduleDate('');
    setActionComment('');
    setActionError(null);
    setActionNotice(null);
  }

  function toActionError(caught: unknown): {
    message: string;
    sessionExpired: boolean;
  } {
    if (!(caught instanceof RequestsApiError)) {
      return { message: NETWORK_ERROR_MESSAGE, sessionExpired: false };
    }
    if (caught.status === 401) {
      return {
        message: 'Su sesión no es válida o venció. Inicie sesión de nuevo.',
        sessionExpired: true,
      };
    }
    if (caught.status === 403) {
      return {
        message: 'No tiene permiso para modificar citas.',
        sessionExpired: false,
      };
    }
    return { message: caught.message, sessionExpired: false };
  }

  function patchStoredAppointment(
    appointmentId: string,
    patch: Partial<AppointmentListItem>,
  ) {
    setPatchedById((current) => ({
      ...current,
      [appointmentId]: {
        ...current[appointmentId],
        ...patch,
      },
    }));
    setOccupancyAttempt((attempt) => attempt + 1);
  }

  async function handleReschedule(
    event: FormEvent<HTMLFormElement>,
    appointment: AppointmentListItem,
  ) {
    event.preventDefault();
    setConfirmingCancel(false);
    if (!rescheduleDate) {
      setActionError({
        message: 'Elija la nueva fecha de la cita.',
        sessionExpired: false,
      });
      return;
    }
    setRescheduling(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await rescheduleAppointment({
        appointmentId: appointment.id,
        date: rescheduleDate,
        comment: actionComment.trim() || undefined,
      });
      patchStoredAppointment(appointment.id, {
        date: result.appointment.date,
        serviceHours: result.appointment.serviceHours,
        status: result.appointment.status,
        request: {
          ...appointment.request,
          status: result.status,
        },
      });
      setRescheduleDate('');
      setActionComment('');
      setActionNotice(
        `Cita reprogramada para el ${formatFullDay(result.appointment.date)}. El cambio quedó en el historial.`,
      );
    } catch (caught: unknown) {
      setActionError(toActionError(caught));
    } finally {
      setRescheduling(false);
    }
  }

  async function handleCancel(appointment: AppointmentListItem) {
    setCancelling(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await cancelAppointment({
        appointmentId: appointment.id,
        comment: actionComment.trim() || undefined,
      });
      patchStoredAppointment(appointment.id, {
        status: 'CANCELADA',
        request: {
          ...appointment.request,
          status: result.status,
        },
      });
      setConfirmingCancel(false);
      setRescheduleDate('');
      setActionComment('');
      setActionNotice(
        'Cita cancelada. El material quedó libre, la solicitud volvió a Disponible y el cambio quedó en el historial.',
      );
    } catch (caught: unknown) {
      setActionError(toActionError(caught));
    } finally {
      setCancelling(false);
    }
  }

  function toLoanSummary(
    record: MaterialLoanRecord,
  ): AppointmentMaterialLoanSummary {
    return {
      id: record.id,
      handedOverAt: record.handedOverAt,
      handedOverBy: record.handedOverBy,
      deliveryNotes: record.deliveryNotes,
      returnedAt: record.returnedAt,
      returnedBy: record.returnedBy,
      returnNotes: record.returnNotes,
    };
  }

  async function handleConfirmLoanAction(notes: string | undefined) {
    if (!loanDialog) return;
    setLoanSubmitting(true);
    setLoanError(null);
    setActionError(null);
    setActionNotice(null);
    try {
      const { mode, appointment, material } = loanDialog;
      const saved =
        mode === 'deliver'
          ? await deliverAppointmentMaterial({
              appointmentId: appointment.id,
              materialId: material.id,
              notes,
            })
          : await returnMaterial({
              materialId: material.id,
              notes,
            });
      const summary = toLoanSummary(saved);
      const updatedMaterials = appointment.materials.map((item) =>
        item.id === material.id
          ? {
              ...item,
              status: saved.materialStatus,
              activeLoan: saved.returnedAt ? null : summary,
              lastLoan: summary,
            }
          : item,
      );
      patchStoredAppointment(appointment.id, { materials: updatedMaterials });
      setLoanDialog(null);
      setActionNotice(
        mode === 'deliver'
          ? `Entrega registrada para «${material.title}» (${formatBogotaDateTime(saved.handedOverAt)}). El material quedó en uso.`
          : `Devolución registrada para «${material.title}»${saved.returnedAt ? ` (${formatBogotaDateTime(saved.returnedAt)})` : ''}. El material volvió a estar disponible.`,
      );
    } catch (caught: unknown) {
      if (caught instanceof MaterialsApiError) {
        setLoanError(
          caught.status === 401
            ? 'Su sesión no es válida o venció. Inicie sesión de nuevo.'
            : caught.message,
        );
      } else {
        setLoanError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setLoanSubmitting(false);
    }
  }

  const applyPatch = (item: AppointmentListItem): AppointmentListItem =>
    patchedById[item.id] ? { ...item, ...patchedById[item.id] } : item;

  const activeOccupancy =
    occupancyState?.rangeKey === occupancyRangeKey ? occupancyState.data : null;
  const dailyCapacity = activeOccupancy?.dailyCapacity ?? DAILY_CAPACITY;
  const nearCapacityThreshold = Math.ceil(dailyCapacity * 0.8);
  const apiOccupancyByDate = new Map<string, number>(
    (activeOccupancy?.days ?? []).map((day) => [day.date, day.occupied]),
  );
  const monthData =
    monthResponse?.key === monthKey ? monthResponse.data : undefined;
  const patchedMonthItems = (monthData?.items ?? []).map(applyPatch);
  const patchedResultItems = (result?.items ?? []).map(applyPatch);
  const appointmentsByDate = new Map<string, AppointmentListItem[]>();
  for (const item of patchedMonthItems) {
    const key = item.date.slice(0, 10);
    const list = appointmentsByDate.get(key) ?? [];
    list.push(item);
    appointmentsByDate.set(key, list);
  }
  const occupancyByDate = new Map<string, number>();
  for (const rawItem of monthData?.occupancy ?? []) {
    const item = applyPatch(rawItem);
    if (item.status !== 'PROGRAMADA' && item.status !== 'CUMPLIDA') {
      continue;
    }
    const key = item.date.slice(0, 10);
    occupancyByDate.set(key, (occupancyByDate.get(key) ?? 0) + 1);
  }

  const visibleDates = new Set(calendarDays.map((day) => day.isoDate));
  const otherMonthItems = patchedResultItems.filter(
    (item) => !visibleDates.has(item.date.slice(0, 10)),
  );

  const selectedAppointment =
    [...patchedMonthItems, ...patchedResultItems].find(
      (item) => item.id === selectedId,
    ) ?? null;

  return (
    <AppLayout>
      <section className={searchStyles.hero} aria-labelledby="calendar-title">
        <PageHeader
          titleId="calendar-title"
          title="Calendario de citas"
          description="Organice las citas de consulta y revise la disponibilidad por día."
        />
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
            placeholder="Solicitante: nombre, correo o documento…"
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
                placeholder="Título o código…"
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
            <h2 id="appointments-results" className={searchStyles.sectionTitle}>
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
                {capitalize(formatMonthTitle(activeMonth))}
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
            {activeOccupancy ? (
              <span className={styles.capacityBadge}>
                Capacidad diaria: {activeOccupancy.dailyCapacity} citas
              </span>
            ) : null}
          </div>

          <div aria-live="polite" aria-busy={isLoading}>
            {isLoading ? <p className={searchStyles.muted}>Cargando…</p> : null}

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

          {result && !monthData ? (
            <div>
              <p
                role={
                  monthResponse?.key === monthKey && monthResponse.error
                    ? 'alert'
                    : 'status'
                }
              >
                {monthResponse?.key === monthKey && monthResponse.error
                  ? monthResponse.error
                  : 'Cargando agenda completa…'}
              </p>
              {monthResponse?.key === monthKey && monthResponse.error ? (
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => setMonthAttempt((attempt) => attempt + 1)}
                >
                  Reintentar cargar agenda
                </button>
              ) : null}
            </div>
          ) : null}
          {result && monthData ? (
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
                  const occupied = Math.max(
                    apiOccupancyByDate.get(day.isoDate) ?? 0,
                    occupancyByDate.get(day.isoDate) ?? 0,
                  );
                  const capacityState =
                    occupied >= dailyCapacity
                      ? 'full'
                      : occupied >= nearCapacityThreshold
                        ? 'near'
                        : 'available';
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
                          <span className={styles.desktopDate}>
                            {day.dayNumber}
                          </span>
                          <span className={styles.mobileDate}>
                            {formatFullDay(day.isoDate)}
                          </span>
                        </span>
                        {day.isSunday ? (
                          <span className={styles.sundayTag}>Cerrado</span>
                        ) : null}
                      </div>
                      <span
                        className={styles.occupancy}
                        data-capacity={capacityState}
                        aria-label={`${formatFullDay(day.isoDate)}: ocupación ${occupied} de ${dailyCapacity}${capacityState === 'full' ? ', capacidad alcanzada' : capacityState === 'near' ? ', cerca del límite' : ''}`}
                      >
                        {occupied}/{dailyCapacity}
                        {capacityState === 'full'
                          ? ' · Límite'
                          : capacityState === 'near'
                            ? ' · Cerca del límite'
                            : ''}
                      </span>
                      {dayItems.length > 0 ? (
                        <ul className={styles.dayEvents}>
                          {dayItems.map((item, index) => (
                            <li
                              key={item.id}
                              className={
                                index >= PREVIEW_COUNT
                                  ? styles.extraEvent
                                  : undefined
                              }
                            >
                              <AppointmentCardButton
                                item={item}
                                selected={selectedId === item.id}
                                onSelect={selectAppointment}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {dayItems.length > PREVIEW_COUNT ? (
                        <button
                          type="button"
                          className={styles.moreButton}
                          aria-haspopup="dialog"
                          aria-label={`Ver las ${dayItems.length} citas del ${formatFullDay(day.isoDate)}; ${dayItems.length - PREVIEW_COUNT} más`}
                          onClick={() => openDayAgenda(day.isoDate)}
                        >
                          +{dayItems.length - PREVIEW_COUNT} más
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <p className={searchStyles.hint}>
                Capacidad diaria: {dailyCapacity}. Ocupación sin filtros,
                excluye citas canceladas y no asistidas. Cerca del límite desde{' '}
                {nearCapacityThreshold} citas.
              </p>

              {expandedDate ? (
                <dialog
                  ref={dayDialog}
                  className={styles.dayDialog}
                  aria-labelledby="day-agenda-title"
                  onClose={(event) => {
                    // A «close» queued before the day was opened again is stale.
                    if (!event.currentTarget.open) setExpandedDate(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Tab') return;
                    const buttons =
                      event.currentTarget.querySelectorAll<HTMLButtonElement>(
                        'button',
                      );
                    const first = buttons[0];
                    const last = buttons[buttons.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                      event.preventDefault();
                      last?.focus();
                    } else if (
                      !event.shiftKey &&
                      document.activeElement === last
                    ) {
                      event.preventDefault();
                      first?.focus();
                    }
                  }}
                >
                  <h2 id="day-agenda-title">
                    Citas del {formatFullDay(expandedDate)}
                  </h2>
                  <form method="dialog">
                    <button className={styles.navButton}>Cerrar</button>
                  </form>
                  <ul className={styles.dayEvents}>
                    {(appointmentsByDate.get(expandedDate) ?? []).map(
                      (item) => (
                        <li key={item.id}>
                          <AppointmentCardButton
                            item={item}
                            selected={selectedId === item.id}
                            onSelect={(id) => {
                              selectAppointment(id);
                              dayDialog.current?.close();
                            }}
                          />
                        </li>
                      ),
                    )}
                  </ul>
                </dialog>
              ) : null}

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
                          onSelect={selectAppointment}
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
                        {APPOINTMENT_STATUS_LABELS[selectedAppointment.status]}
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
                        {formatHour(selectedAppointment.serviceHours.opensAt)} a{' '}
                        {formatHour(selectedAppointment.serviceHours.closesAt)}
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
                      {selectedAppointment.materials.map((materialItem) => {
                        const materialStatus =
                          materialItem.status ?? 'DISPONIBLE';
                        const isToday =
                          selectedAppointment.date === todayInBogotaIso();
                        const canDeliver =
                          selectedAppointment.status === 'PROGRAMADA' &&
                          isToday &&
                          !materialItem.activeLoan &&
                          materialStatus === 'DISPONIBLE';
                        const canReturn = Boolean(materialItem.activeLoan);

                        return (
                          <li
                            key={materialItem.id}
                            className={styles.detailMaterialItem}
                          >
                            <strong>{materialItem.title}</strong>
                            <span className={styles.detailMeta}>
                              {materialItem.catalogCode} ·{' '}
                              {MATERIAL_TYPE_LABELS[
                                materialItem.materialType as MaterialType
                              ] ?? materialItem.materialType}{' '}
                              · {MATERIAL_STATUS_LABELS[materialStatus]}
                            </span>
                            {materialItem.activeLoan ? (
                              <span className={styles.loanStatus}>
                                Entregado{' '}
                                {formatBogotaDateTime(
                                  materialItem.activeLoan.handedOverAt,
                                )}{' '}
                                por {materialItem.activeLoan.handedOverBy.name}
                              </span>
                            ) : materialItem.lastLoan?.returnedAt ? (
                              <span className={styles.loanStatus}>
                                Última devolución:{' '}
                                {formatBogotaDateTime(
                                  materialItem.lastLoan.returnedAt,
                                )}
                                {materialItem.lastLoan.returnedBy
                                  ? ` · recibió ${materialItem.lastLoan.returnedBy.name}`
                                  : ''}
                              </span>
                            ) : null}
                            {canDeliver || canReturn ? (
                              <div className={styles.loanActions}>
                                {canDeliver ? (
                                  <button
                                    type="button"
                                    className={styles.loanButton}
                                    onClick={() => {
                                      setLoanError(null);
                                      setLoanDialog({
                                        mode: 'deliver',
                                        appointment: selectedAppointment,
                                        material: materialItem,
                                      });
                                    }}
                                    aria-label={`Registrar entrega de ${materialItem.title}`}
                                  >
                                    Registrar entrega
                                  </button>
                                ) : null}
                                {canReturn ? (
                                  <button
                                    type="button"
                                    className={styles.loanReturnButton}
                                    onClick={() => {
                                      setLoanError(null);
                                      setLoanDialog({
                                        mode: 'return',
                                        appointment: selectedAppointment,
                                        material: materialItem,
                                      });
                                    }}
                                    aria-label={`Registrar devolución de ${materialItem.title}`}
                                  >
                                    Registrar devolución
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {actionNotice ? (
                    <p className={styles.actionNotice} role="status">
                      {actionNotice}
                    </p>
                  ) : null}

                  {actionError ? (
                    <div className={searchStyles.error} role="alert">
                      <p>{actionError.message}</p>
                      {actionError.sessionExpired ? (
                        <Link to={ROUTES.login}>Iniciar sesión</Link>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedAppointment.status === 'PROGRAMADA' ? (
                    <form
                      className={styles.manageSection}
                      aria-label="Reprogramar o cancelar cita"
                      onSubmit={(event) =>
                        void handleReschedule(event, selectedAppointment)
                      }
                      noValidate
                    >
                      <h4 className={styles.manageTitle}>
                        Reprogramar o cancelar cita
                      </h4>
                      <div className={styles.manageFields}>
                        <div className={styles.manageField}>
                          <label htmlFor="reschedule-date">
                            Nueva fecha de la cita
                          </label>
                          <input
                            id="reschedule-date"
                            type="date"
                            value={rescheduleDate}
                            onChange={(event) =>
                              setRescheduleDate(event.target.value)
                            }
                          />
                        </div>
                        <div className={styles.manageField}>
                          <label htmlFor="appointment-action-comment">
                            Observación (opcional)
                          </label>
                          <input
                            id="appointment-action-comment"
                            type="text"
                            maxLength={500}
                            value={actionComment}
                            onChange={(event) =>
                              setActionComment(event.target.value)
                            }
                            placeholder="Motivo del cambio o cancelación…"
                          />
                        </div>
                      </div>
                      {confirmingCancel ? (
                        <div
                          className={styles.cancelConfirm}
                          role="group"
                          aria-labelledby="cancel-appointment-question"
                        >
                          <p
                            id="cancel-appointment-question"
                            ref={cancelQuestion}
                            tabIndex={-1}
                            className={styles.cancelQuestion}
                          >
                            ¿Cancelar la cita del{' '}
                            {formatFullDay(selectedAppointment.date)}? El
                            material quedará libre y la solicitud volverá a
                            Disponible.
                          </p>
                          <div className={styles.manageActions}>
                            <button
                              className={styles.cancelButton}
                              type="button"
                              disabled={cancelling}
                              onClick={() =>
                                void handleCancel(selectedAppointment)
                              }
                            >
                              {cancelling ? 'Cancelando…' : 'Sí, cancelar cita'}
                            </button>
                            <button
                              className={styles.keepButton}
                              type="button"
                              disabled={cancelling}
                              onClick={keepAppointment}
                            >
                              No, conservar cita
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.manageActions}>
                          <button
                            className={searchStyles.primary}
                            type="submit"
                            disabled={rescheduling || cancelling}
                          >
                            {rescheduling
                              ? 'Reprogramando…'
                              : 'Reprogramar cita'}
                          </button>
                          <button
                            ref={cancelTrigger}
                            className={styles.cancelButton}
                            type="button"
                            disabled={rescheduling || cancelling}
                            onClick={() => {
                              setActionError(null);
                              setActionNotice(null);
                              setConfirmingCancel(true);
                            }}
                          >
                            Cancelar cita
                          </button>
                        </div>
                      )}
                    </form>
                  ) : null}
                </section>
              ) : null}

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

      {loanDialog ? (
        <LoanActionModal
          mode={loanDialog.mode}
          materialTitle={loanDialog.material.title}
          materialCatalogCode={loanDialog.material.catalogCode}
          submitting={loanSubmitting}
          error={loanError}
          onConfirm={handleConfirmLoanAction}
          onCancel={() => setLoanDialog(null)}
        />
      ) : null}
    </AppLayout>
  );
}
