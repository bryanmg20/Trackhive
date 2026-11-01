import { User } from '../../domain/entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';

export class UserResponseMapper {
  static toDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
    };
  }
}
