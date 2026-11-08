import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { PrismaUserMapper } from '../mappers/prisma-user.mapper';

const UNIQUE_CONSTRAINT_ERROR = 'P2002';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    const data = PrismaUserMapper.toPersistence(user);
    try {
      await this.prisma.userModel.upsert({
        where: { id: user.id },
        update: {
          fullName: data.fullName,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role,
          active: data.active,
        },
        create: data,
      });
    } catch (error) {
      // The unique index protects against two simultaneous registrations
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_ERROR
      ) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    const models = await this.prisma.userModel.findMany();
    return models.map((model) => PrismaUserMapper.toDomain(model));
  }

  async findById(id: string): Promise<User | null> {
    const model = await this.prisma.userModel.findUnique({ where: { id } });
    return model ? PrismaUserMapper.toDomain(model) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const model = await this.prisma.userModel.findFirst({
      // Registration normalizes emails, but existing rows may not be lowercase
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    return model ? PrismaUserMapper.toDomain(model) : null;
  }
}
