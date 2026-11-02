import { UserModel } from '@prisma/client';
import { User } from '../../domain/entities/user.entity';

export class PrismaUserMapper {
  static toDomain(model: UserModel): User {
    return new User(model.id, model.email);
  }

  static toPersistence(entity: User) {
    return {
      id: entity.id,
      email: entity.email,
    };
  }
}
