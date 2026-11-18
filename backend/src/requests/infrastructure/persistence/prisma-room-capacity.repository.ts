import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import type { RoomCapacityConfig } from '../../domain/value-objects/room-capacity';
import {
  PrismaRoomCapacityMapper,
  ROOM_CAPACITY_INCLUDE,
} from '../mappers/prisma-room-capacity.mapper';

/** Reads and saves the singleton daily capacity setting (HU-20.1). */
@Injectable()
export class PrismaRoomCapacityRepository implements IRoomCapacityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<RoomCapacityConfig> {
    const model = await this.prisma.readingRoomConfigModel.findUnique({
      where: { id: 1 },
      include: ROOM_CAPACITY_INCLUDE,
    });
    return PrismaRoomCapacityMapper.toDomain(model);
  }

  async saveDailyCapacity(
    dailyCapacity: number,
    updatedById: string,
  ): Promise<RoomCapacityConfig> {
    const model = await this.prisma.readingRoomConfigModel.upsert({
      where: { id: 1 },
      create: PrismaRoomCapacityMapper.toCreate(dailyCapacity, updatedById),
      update: PrismaRoomCapacityMapper.toUpdate(dailyCapacity, updatedById),
      include: ROOM_CAPACITY_INCLUDE,
    });
    return PrismaRoomCapacityMapper.toDomain(model);
  }
}
