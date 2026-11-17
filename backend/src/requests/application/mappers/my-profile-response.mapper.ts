import type { User } from '../../../users/domain/entities/user.entity';
import type { Requester } from '../../domain/entities/requester.entity';
import { MyProfileResponseDto } from '../dto/my-profile-response.dto';

export class MyProfileResponseMapper {
  static toDto(user: User, requester: Requester | null): MyProfileResponseDto {
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      municipality: requester?.props.municipality ?? null,
      ageRange: requester?.props.ageRange ?? null,
      populationGroup: requester?.props.populationGroup ?? null,
    };
  }
}
