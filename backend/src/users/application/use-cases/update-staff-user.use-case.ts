import { Inject, Injectable } from '@nestjs/common';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import { StaffUserNotFoundError } from '../../domain/errors/staff-user-not-found.error';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import { StaffUserResponseDto } from '../dto/staff-user-response.dto';
import type { UpdateStaffUserInput } from '../dto/update-staff-user.input';
import { StaffUserResponseMapper } from '../mappers/staff-user-response.mapper';
import { USER_REPOSITORY } from '../tokens';

/**
 * An administrator edits a staff account (HU-05): names and email, and
 * deactivates or reactivates it. The role never changes. A deactivated
 * account keeps its requests and history; it just cannot sign in or renew
 * its session.
 */
@Injectable()
export class UpdateStaffUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateStaffUserInput): Promise<StaffUserResponseDto> {
    const user = await this.userRepo.findById(input.userId);
    // Public accounts are not managed by the administrator
    if (!user || !user.isStaff()) {
      throw new StaffUserNotFoundError();
    }

    const updated = user.updateStaffAccount(
      {
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        secondLastName: input.secondLastName,
        email: input.email,
        active: input.active,
      },
      input.changedBy,
    );

    if (updated.email !== user.email) {
      const owner = await this.userRepo.findByEmail(updated.email);
      if (owner && owner.id !== user.id) {
        throw new EmailAlreadyExistsError();
      }
    }

    await this.userRepo.save(updated);
    return StaffUserResponseMapper.toDto(updated);
  }
}
