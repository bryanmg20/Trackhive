import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Requester } from '../../../requests/domain/entities/requester.entity';
import { PrismaRequesterMapper } from '../../../requests/infrastructure/mappers/prisma-requester.mapper';
import type { IAccountRegistration } from '../../application/ports/account-registration.port';
import type { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import { PrismaUserMapper } from '../mappers/prisma-user.mapper';

@Injectable()
export class PrismaAccountRegistration implements IAccountRegistration {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User, requester: Requester): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.userModel.create({
          data: PrismaUserMapper.toPersistence(user),
        });
        await tx.requesterModel.create({
          data: PrismaRequesterMapper.toPersistence(requester),
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }
}
