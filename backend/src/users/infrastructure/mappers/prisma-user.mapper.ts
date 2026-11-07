import { UserModel } from '@prisma/client';
import { User } from '../../domain/entities/user.entity';
import { InvalidRoleError } from '../../domain/errors/invalid-role.error';
import { isUserRole } from '../../domain/user-role';

export class PrismaUserMapper {
  static toDomain(model: UserModel): User {
    if (!isUserRole(model.role)) {
      throw new InvalidRoleError();
    }
    return new User({
      id: model.id,
      fullName: model.fullName,
      email: model.email,
      passwordHash: model.passwordHash,
      role: model.role,
    });
  }

  static toPersistence(entity: User) {
    return {
      id: entity.id,
      fullName: entity.fullName,
      email: entity.email,
      passwordHash: entity.passwordHash,
      role: entity.role,
    };
  }
}
