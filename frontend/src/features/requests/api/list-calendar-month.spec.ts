import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAppointments } from './list-appointments';
import type {
  AppointmentListItem,
  ListAppointmentsParams,
} from './list-appointments';
import { listCalendarMonth } from './list-calendar-month';

vi.mock('./list-appointments', () => ({ listAppointments: vi.fn() }));
const list = vi.mocked(listAppointments);
const params: ListAppointmentsParams = {
  sort: 'appointmentDate',
  order: 'asc',
  page: 3,
  limit: 20,
};
const item = (id: number, status = 'PROGRAMADA') =>
  ({ id: String(id), status }) as AppointmentListItem;

describe('listCalendarMonth', () => {
  beforeEach(() => list.mockReset());

  it('collects every API page, independently of the listing page', async () => {
    list.mockResolvedValueOnce({
      items: Array.from({ length: 100 }, (_, i) => item(i)),
      total: 101,
      page: 1,
      limit: 100,
    });
    list.mockResolvedValueOnce({
      items: [item(100)],
      total: 101,
      page: 2,
      limit: 100,
    });
    const result = await listCalendarMonth(params, '2026-11-01', '2026-11-30');
    expect(result.items).toHaveLength(101);
    expect(result.items.at(-1)?.id).toBe('100');
    expect(list).toHaveBeenNthCalledWith(2, {
      ...params,
      from: '2026-11-01',
      to: '2026-11-30',
      page: 2,
      limit: 100,
    });
  });

  it('keeps occupancy independent of filters and excludes cancellations', async () => {
    list.mockResolvedValueOnce({
      items: [
        item(1),
        item(2, 'CUMPLIDA'),
        item(3, 'CANCELADA'),
        item(4, 'NO_ASISTIO'),
      ],
      total: 4,
      page: 1,
      limit: 100,
    });
    list.mockResolvedValueOnce({
      items: [item(2, 'CUMPLIDA')],
      total: 1,
      page: 1,
      limit: 100,
    });
    const result = await listCalendarMonth(
      { ...params, requester: 'Ana', from: '2026-11-10', to: '2026-12-10' },
      '2026-11-01',
      '2026-11-30',
    );
    expect(result.items.map((entry) => entry.id)).toEqual(['2']);
    expect(result.occupancy.map((entry) => entry.id)).toEqual(['1', '2']);
    expect(list).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({ requester: 'Ana' }),
    );
    expect(list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        requester: 'Ana',
        from: '2026-11-10',
        to: '2026-11-30',
      }),
    );
  });

  it('does not query an inverted date range when filters fall outside the month', async () => {
    list.mockResolvedValueOnce({
      items: [item(1)],
      total: 1,
      page: 1,
      limit: 100,
    });
    const result = await listCalendarMonth(
      { ...params, from: '2027-01-01' },
      '2026-11-01',
      '2026-11-30',
    );
    expect(result.items).toEqual([]);
    expect(result.occupancy).toHaveLength(1);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('rejects a failed page instead of returning partial counts', async () => {
    list.mockResolvedValueOnce({
      items: Array.from({ length: 100 }, (_, i) => item(i)),
      total: 101,
      page: 1,
      limit: 100,
    });
    list.mockRejectedValueOnce(new Error('Network unavailable'));
    await expect(
      listCalendarMonth(params, '2026-11-01', '2026-11-30'),
    ).rejects.toThrow('Network unavailable');
  });
});
