import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Requester } from '../../domain/entities/requester.entity';
import type { IRequesterRepository } from '../../domain/repositories/requester.repository';
import { PrismaRequesterMapper } from '../mappers/prisma-requester.mapper';

/** Saves and loads the Requester entity (HU-09, HU-10). */
@Injectable()
export class PrismaRequesterRepository implements IRequesterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Requester | null> {
    const model = await this.prisma.requesterModel.findUnique({
      where: { userId },
    });
    return model ? PrismaRequesterMapper.toDomain(model) : null;
  }

  async findByEmail(email: string): Promise<Requester | null> {
    const model = await this.prisma.requesterModel.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
    return model ? PrismaRequesterMapper.toDomain(model) : null;
  }

  async save(requester: Requester): Promise<void> {
    await this.prisma.requesterModel.create({
      data: PrismaRequesterMapper.toPersistence(requester),
    });
  }
}
