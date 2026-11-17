import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { USER_REPOSITORY } from '../../../users/application/tokens';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { UserNotFoundError } from '../../../users/domain/errors/user-not-found.error';
import { Requester } from '../../domain/entities/requester.entity';
import { Characterization } from '../../domain/value-objects/characterization';
import type { IRequesterRepository } from '../../domain/repositories/requester.repository';
import type { UpdateMyProfileInput } from '../dto/update-my-profile.input';
import type { MyProfileResponseDto } from '../dto/my-profile-response.dto';
import { MyProfileResponseMapper } from '../mappers/my-profile-response.mapper';
import { REQUESTER_REPOSITORY } from '../tokens';

@Injectable()
export class UpdateMyProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(REQUESTER_REPOSITORY)
    private readonly requesters: IRequesterRepository,
  ) {}

  async execute(input: UpdateMyProfileInput): Promise<MyProfileResponseDto> {
    const data = new Characterization(input);
    const user = await this.users.findById(input.userId);
    if (!user) throw new UserNotFoundError();
    const current =
      (await this.requesters.findByUserId(user.id)) ??
      Requester.fromUser(user, randomUUID());
    const requester = current.withCharacterization(data);
    await this.requesters.save(requester);
    return MyProfileResponseMapper.toDto(user, requester);
  }
}
