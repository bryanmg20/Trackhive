import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { PrismaRefreshTokenMapper } from '../mappers/prisma-refresh-token.mapper';

@Injectable()
export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(token: RefreshToken): Promise<void> {
    await this.prisma.refreshTokenModel.create({
      data: PrismaRefreshTokenMapper.toPersistence(token),
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const model = await this.prisma.refreshTokenModel.findUnique({
      where: { tokenHash },
    });
    return model ? PrismaRefreshTokenMapper.toDomain(model) : null;
  }

  async revoke(id: string, revokedAt: Date): Promise<boolean> {
    // Conditional UPDATE: PostgreSQL lets only one concurrent request change
    // the row while revoked_at is still NULL; the other one updates 0 rows
    const { count } = await this.prisma.refreshTokenModel.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt },
    });
    return count === 1;
  }

  async revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshTokenModel.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
