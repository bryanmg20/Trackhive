import {
  isRoomFull,
  remainingRoomSlots,
} from '../../domain/policies/room-capacity';
import type {
  DayOccupancyCount,
  RoomCapacityConfig,
} from '../../domain/value-objects/room-capacity';
import { RoomCapacityResponseDto } from '../dto/room-capacity-response.dto';
import { RoomOccupancyResponseDto } from '../dto/room-occupancy-response.dto';
import { PersonNameMapper } from './person-name.mapper';

/** Translates reading room capacity and occupancy to their API DTOs (HU-20.1). */
export class RoomCapacityResponseMapper {
  static toDto(config: RoomCapacityConfig): RoomCapacityResponseDto {
    return {
      dailyCapacity: config.dailyCapacity,
      isDefault: config.isDefault,
      updatedAt: config.updatedAt ? config.updatedAt.toISOString() : null,
      updatedBy: config.updatedBy
        ? {
            id: config.updatedBy.id,
            name: PersonNameMapper.fullName(config.updatedBy),
          }
        : null,
    };
  }

  static toOccupancyDto(
    dailyCapacity: number,
    counts: DayOccupancyCount[],
  ): RoomOccupancyResponseDto {
    return {
      dailyCapacity,
      days: counts.map(({ date, occupied }) => ({
        date,
        occupied,
        available: remainingRoomSlots(occupied, dailyCapacity),
        isFull: isRoomFull(occupied, dailyCapacity),
      })),
    };
  }
}
