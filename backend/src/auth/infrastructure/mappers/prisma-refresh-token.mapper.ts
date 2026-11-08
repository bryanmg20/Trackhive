import { RefreshTokenModel } from '@prisma/client';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';

export class PrismaRefreshTokenMapper {
  static toDomain(model: RefreshTokenModel): RefreshToken {
    return new RefreshToken({
      id: model.id,
      userId: model.userId,
      tokenHash: model.tokenHash,
      expiresAt: model.expiresAt,
      revokedAt: model.revokedAt,
    });
  }

  static toPersistence(entity: RefreshToken) {
    return {
      id: entity.id,
      userId: entity.userId,
      tokenHash: entity.tokenHash,
      expiresAt: entity.expiresAt,
      revokedAt: entity.revokedAt,
    };
  }
}
