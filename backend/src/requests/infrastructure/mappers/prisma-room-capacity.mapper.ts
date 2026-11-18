import { Prisma } from '@prisma/client';
import { DEFAULT_DAILY_ROOM_CAPACITY } from '../../domain/policies/room-capacity';
import type { RoomCapacityConfig } from '../../domain/value-objects/room-capacity';

export const ROOM_CAPACITY_INCLUDE = {
  updatedBy: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      secondLastName: true,
    },
  },
} satisfies Prisma.ReadingRoomConfigModelInclude;

type ReadingRoomConfigWithUser = Prisma.ReadingRoomConfigModelGetPayload<{
  include: typeof ROOM_CAPACITY_INCLUDE;
}>;

/** Translates reading_room_config rows between Prisma and the domain (R8). */
export class PrismaRoomCapacityMapper {
  static toDomain(model: ReadingRoomConfigWithUser | null): RoomCapacityConfig {
    if (!model) {
      return {
        dailyCapacity: DEFAULT_DAILY_ROOM_CAPACITY,
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      };
    }

    return {
      dailyCapacity: model.dailyCapacity,
      isDefault: false,
      updatedAt: model.updatedAt,
      updatedBy: model.updatedBy,
    };
  }

  static toCreate(
    dailyCapacity: number,
    updatedById: string,
  ): Prisma.ReadingRoomConfigModelUncheckedCreateInput {
    return {
      id: 1,
      dailyCapacity,
      updatedById,
    };
  }

  static toUpdate(
    dailyCapacity: number,
    updatedById: string,
  ): Prisma.ReadingRoomConfigModelUncheckedUpdateInput {
    return {
      dailyCapacity,
      updatedById,
    };
  }
}
