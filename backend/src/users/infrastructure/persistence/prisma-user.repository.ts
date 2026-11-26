import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import {
  IUserRepository,
  UserSearchCriteria,
  UserSearchResult,
  UserSortField,
} from '../../domain/repositories/user.repository';
import { PrismaUserMapper } from '../mappers/prisma-user.mapper';

// After the chosen field, rows are ordered by name so pages read naturally
const NAME_ORDER: UserSortField[] = ['lastName', 'firstName'];

const UNIQUE_CONSTRAINT_ERROR = 'P2002';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    const data = PrismaUserMapper.toPersistence(user);
    try {
      await this.prisma.userModel.upsert({
        where: { id: user.id },
        update: PrismaUserMapper.toUpdate(user),
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
    const models = await this.prisma.userModel.findMany({
      where: { deletedAt: null },
    });
    return models.map((model) => PrismaUserMapper.toDomain(model));
  }

  async findById(id: string): Promise<User | null> {
    const model = await this.prisma.userModel.findUnique({
      where: { id, deletedAt: null },
    });
    return model ? PrismaUserMapper.toDomain(model) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const model = await this.prisma.userModel.findFirst({
      // Registration normalizes emails, but existing rows may not be lowercase
      where: { deletedAt: null, email: { equals: email, mode: 'insensitive' } },
    });
    return model ? PrismaUserMapper.toDomain(model) : null;
  }

  async search(criteria: UserSearchCriteria): Promise<UserSearchResult> {
    const where = this.buildWhere(criteria);

    // Same filter for the page and the total, in one transaction
    const [models, total] = await this.prisma.$transaction([
      this.prisma.userModel.findMany({
        where,
        orderBy: this.buildOrderBy(criteria),
        skip: (criteria.page - 1) * criteria.limit,
        take: criteria.limit,
      }),
      this.prisma.userModel.count({ where }),
    ]);

    return {
      items: models.map((model) => PrismaUserMapper.toDomain(model)),
      total,
    };
  }

  private buildWhere(criteria: UserSearchCriteria): Prisma.UserModelWhereInput {
    const and: Prisma.UserModelWhereInput[] = [
      { deletedAt: null },
      { role: { in: [...criteria.roles] } },
    ];
    if (criteria.active !== undefined) {
      and.push({ active: criteria.active });
    }
    // Every word must match some field, so "ana pérez" finds "Ana María Pérez"
    for (const word of criteria.q?.split(/\s+/).filter(Boolean) ?? []) {
      const text = { contains: word, mode: 'insensitive' as const };
      and.push({
        OR: [
          { firstName: text },
          { middleName: text },
          { lastName: text },
          { secondLastName: text },
          { email: text },
        ],
      });
    }
    return { AND: and };
  }

  private buildOrderBy(
    criteria: UserSearchCriteria,
  ): Prisma.UserModelOrderByWithRelationInput[] {
    const fields = [
      criteria.sort,
      ...NAME_ORDER.filter((field) => field !== criteria.sort),
    ];
    return [
      ...fields.map((field, index) => ({
        [field]: index === 0 ? criteria.order : 'asc',
      })),
      // Tie-breaker so pages do not repeat or skip rows
      { id: 'asc' },
    ];
  }
}
