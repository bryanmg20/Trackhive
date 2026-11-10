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
      firstName: model.firstName,
      middleName: model.middleName,
      lastName: model.lastName,
      secondLastName: model.secondLastName,
      email: model.email,
      passwordHash: model.passwordHash,
      role: model.role,
      active: model.active,
      privacyPolicyAcceptedAt: model.privacyPolicyAcceptedAt,
      privacyPolicyVersion: model.privacyPolicyVersion,
    });
  }

  static toPersistence(entity: User) {
    return {
      id: entity.id,
      firstName: entity.firstName,
      middleName: entity.middleName,
      lastName: entity.lastName,
      secondLastName: entity.secondLastName,
      email: entity.email,
      passwordHash: entity.passwordHash,
      role: entity.role,
      active: entity.active,
      privacyPolicyAcceptedAt: entity.privacyPolicyAcceptedAt,
      privacyPolicyVersion: entity.privacyPolicyVersion,
    };
  }
}
