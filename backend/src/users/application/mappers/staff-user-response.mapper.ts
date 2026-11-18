import { User } from '../../domain/entities/user.entity';
import {
  PaginatedStaffUsersResponseDto,
  StaffUserResponseDto,
} from '../dto/staff-user-response.dto';
import { UserResponseMapper } from './user-response.mapper';

/** A staff account → its response, with whether it is active (HU-05). */
export class StaffUserResponseMapper {
  static toDto(user: User): StaffUserResponseDto {
    return { ...UserResponseMapper.toDto(user), active: user.active };
  }

  static toPaginatedDto(
    users: User[],
    pagination: { page: number; limit: number; total: number },
  ): PaginatedStaffUsersResponseDto {
    return {
      items: users.map((user) => StaffUserResponseMapper.toDto(user)),
      ...pagination,
    };
  }
}
