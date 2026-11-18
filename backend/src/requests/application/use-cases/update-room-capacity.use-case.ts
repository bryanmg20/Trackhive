import { Inject, Injectable } from '@nestjs/common';
import { assertValidDailyCapacity } from '../../domain/policies/room-capacity';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import { RoomCapacityResponseDto } from '../dto/room-capacity-response.dto';
import type { UpdateRoomCapacityInput } from '../dto/update-room-capacity.input';
import { RoomCapacityResponseMapper } from '../mappers/room-capacity-response.mapper';
import { ROOM_CAPACITY_REPOSITORY } from '../tokens';

/**
 * Updates the daily capacity of the reading room (HU-20.1, RN-19).
 * Existing appointments are never modified or cancelled; the new limit applies
 * to new scheduling requests.
 */
@Injectable()
export class UpdateRoomCapacityUseCase {
  constructor(
    @Inject(ROOM_CAPACITY_REPOSITORY)
    private readonly repository: IRoomCapacityRepository,
  ) {}

  async execute(
    input: UpdateRoomCapacityInput,
  ): Promise<RoomCapacityResponseDto> {
    assertValidDailyCapacity(input.dailyCapacity);
    const saved = await this.repository.saveDailyCapacity(
      input.dailyCapacity,
      input.userId,
    );
    return RoomCapacityResponseMapper.toDto(saved);
  }
}
