import type { RoomCapacityConfig } from '../value-objects/room-capacity';

/**
 * Persistence contract for the singleton daily capacity setting (HU-20.1).
 * Returns the domain default (15/day) when no custom setting exists yet.
 */
export interface IRoomCapacityRepository {
  getConfig(): Promise<RoomCapacityConfig>;

  saveDailyCapacity(
    dailyCapacity: number,
    updatedById: string,
  ): Promise<RoomCapacityConfig>;
}
