import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import { readErrorMessage, RequestsApiError } from './list-requests';

export interface RoomCapacityConfig {
  dailyCapacity: number;
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}

export interface DayOccupancy {
  date: string;
  occupied: number;
  available: number;
  isFull: boolean;
}

export interface RoomOccupancy {
  dailyCapacity: number;
  days: DayOccupancy[];
}

export async function getRoomCapacity(): Promise<RoomCapacityConfig> {
  const response = await authenticatedFetch(
    apiUrl('/api/v1/appointments/capacity'),
  );
  if (!response.ok) {
    throw new RequestsApiError(await readErrorMessage(response), response.status);
  }
  return (await response.json()) as RoomCapacityConfig;
}

export async function updateRoomCapacity(
  dailyCapacity: number,
): Promise<RoomCapacityConfig> {
  const response = await authenticatedFetch(
    apiUrl('/api/v1/appointments/capacity'),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyCapacity }),
    },
  );
  if (!response.ok) {
    throw new RequestsApiError(await readErrorMessage(response), response.status);
  }
  return (await response.json()) as RoomCapacityConfig;
}

export async function getRoomOccupancy(
  from: string,
  to: string,
): Promise<RoomOccupancy> {
  const params = new URLSearchParams({ from, to });
  const response = await authenticatedFetch(
    apiUrl(`/api/v1/appointments/occupancy?${params.toString()}`),
  );
  if (!response.ok) {
    throw new RequestsApiError(await readErrorMessage(response), response.status);
  }
  return (await response.json()) as RoomOccupancy;
}
