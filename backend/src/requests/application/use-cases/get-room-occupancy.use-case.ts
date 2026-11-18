import { Inject, Injectable } from '@nestjs/common';
import {
  expandOccupancyDateRange,
  fillDailyOccupancy,
} from '../../domain/policies/room-capacity';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import type { GetRoomOccupancyInput } from '../dto/get-room-occupancy.input';
import { RoomOccupancyResponseDto } from '../dto/room-occupancy-response.dto';
import { RoomCapacityResponseMapper } from '../mappers/room-capacity-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE, ROOM_CAPACITY_REPOSITORY } from '../tokens';

/**
 * Returns daily capacity and active appointment counts for each day in a
 * date range so staff can inspect room availability (HU-20.1).
 */
@Injectable()
export class GetRoomOccupancyUseCase {
  constructor(
    @Inject(ROOM_CAPACITY_REPOSITORY)
    private readonly repository: IRoomCapacityRepository,
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: GetRoomOccupancyInput,
  ): Promise<RoomOccupancyResponseDto> {
    const { fromDate, toDate, isoDays } = expandOccupancyDateRange(
      input.from,
      input.to,
    );
    const [config, counts] = await Promise.all([
      this.repository.getConfig(),
      this.queries.countActiveAppointmentsByDateRange(fromDate, toDate),
    ]);
    return RoomCapacityResponseMapper.toOccupancyDto(
      config.dailyCapacity,
      fillDailyOccupancy(isoDays, counts),
    );
  }
}
