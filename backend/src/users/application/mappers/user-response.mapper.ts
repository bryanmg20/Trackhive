import { User } from '../../domain/entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';

export class UserResponseMapper {
  static toDto(user: User): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
  }
}
