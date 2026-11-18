import { listAppointments } from './list-appointments';
import type {
  AppointmentListItem,
  ListAppointmentsParams,
} from './list-appointments';

/** The calendar must not truncate a busy day at an API page boundary. */
async function collect(
  params: ListAppointmentsParams,
): Promise<AppointmentListItem[]> {
  const items: AppointmentListItem[] = [];
  let page = 1;
  let total: number;
  do {
    const result = await listAppointments({ ...params, page, limit: 100 });
    items.push(...result.items);
    total = result.total;
    if (result.items.length === 0 && items.length < total) {
      throw new Error('La agenda cambió durante la carga. Inténtelo de nuevo.');
    }
    page += 1;
  } while (items.length < total);
  return items;
}

export async function listCalendarMonth(
  params: ListAppointmentsParams,
  from: string,
  to: string,
) {
  const unfiltered = {
    sort: params.sort,
    order: params.order,
    page: 1,
    limit: 100,
    from,
    to,
  };
  const filtered = {
    ...params,
    from: params.from && params.from > from ? params.from : from,
    to: params.to && params.to < to ? params.to : to,
  };
  const hasFilters = Boolean(
    params.status ||
    params.requester ||
    params.material ||
    params.from ||
    params.to,
  );
  const [all, matches] = await Promise.all([
    collect(unfiltered),
    hasFilters
      ? filtered.from > filtered.to
        ? Promise.resolve([])
        : collect(filtered)
      : Promise.resolve(null),
  ]);
  return {
    items: matches ?? all,
    occupancy: all.filter(
      (item) => item.status !== 'CANCELADA' && item.status !== 'NO_ASISTIO',
    ),
  };
}
