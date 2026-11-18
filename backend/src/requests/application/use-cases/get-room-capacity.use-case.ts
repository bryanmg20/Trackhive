import { Inject, Injectable } from '@nestjs/common';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import { RoomCapacityResponseDto } from '../dto/room-capacity-response.dto';
import { RoomCapacityResponseMapper } from '../mappers/room-capacity-response.mapper';
import { ROOM_CAPACITY_REPOSITORY } from '../tokens';

/** Reads the current daily capacity of the reading room (HU-20.1). */
@Injectable()
export class GetRoomCapacityUseCase {
  constructor(
    @Inject(ROOM_CAPACITY_REPOSITORY)
    private readonly repository: IRoomCapacityRepository,
  ) {}

  async execute(): Promise<RoomCapacityResponseDto> {
    const config = await this.repository.getConfig();
    return RoomCapacityResponseMapper.toDto(config);
  }
}
