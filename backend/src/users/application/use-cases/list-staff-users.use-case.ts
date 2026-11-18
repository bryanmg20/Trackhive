import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_USER_PAGE_LIMIT } from '../../../common/pagination';
import { STAFF_ROLES } from '../../domain/enums/user-role';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import type { ListStaffUsersInput } from '../dto/list-staff-users.input';
import { PaginatedStaffUsersResponseDto } from '../dto/staff-user-response.dto';
import { StaffUserResponseMapper } from '../mappers/staff-user-response.mapper';
import { USER_REPOSITORY } from '../tokens';

/** The staff accounts with filters, order and pages (HU-05). */
@Injectable()
export class ListStaffUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(
    input: ListStaffUsersInput,
  ): Promise<PaginatedStaffUsersResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_USER_PAGE_LIMIT;

    const { items, total } = await this.userRepo.search({
      q: input.q,
      // Only staff accounts: public accounts are not managed here
      roles: STAFF_ROLES.filter(
        (role) => input.role === undefined || role === input.role,
      ),
      active: input.active,
      // Alphabetical by last name by default, like a staff directory
      sort: input.sort ?? 'lastName',
      order: input.order ?? 'asc',
      page,
      limit,
    });

    return StaffUserResponseMapper.toPaginatedDto(items, {
      page,
      limit,
      total,
    });
  }
}
