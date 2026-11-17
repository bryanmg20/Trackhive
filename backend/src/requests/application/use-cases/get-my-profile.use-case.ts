import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../users/application/tokens';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { UserNotFoundError } from '../../../users/domain/errors/user-not-found.error';
import type { IRequesterRepository } from '../../domain/repositories/requester.repository';
import type { MyProfileInput } from '../dto/my-profile.input';
import type { MyProfileResponseDto } from '../dto/my-profile-response.dto';
import { MyProfileResponseMapper } from '../mappers/my-profile-response.mapper';
import { REQUESTER_REPOSITORY } from '../tokens';

@Injectable()
export class GetMyProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(REQUESTER_REPOSITORY)
    private readonly requesters: IRequesterRepository,
  ) {}

  async execute(input: MyProfileInput): Promise<MyProfileResponseDto> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new UserNotFoundError();
    const requester = await this.requesters.findByUserId(user.id);
    return MyProfileResponseMapper.toDto(user, requester);
  }
}
