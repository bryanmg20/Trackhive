import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { PrismaUserMapper } from '../mappers/prisma-user.mapper';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    const data = PrismaUserMapper.toPersistence(user);
    await this.prisma.userModel.upsert({
      where: { id: user.id },
      update: data,
      create: data,
    });
  }

  async findAll(): Promise<User[]> {
    const models = await this.prisma.userModel.findMany();
    return models.map((model) => PrismaUserMapper.toDomain(model));
  }

  async findById(id: string): Promise<User | null> {
    const model = await this.prisma.userModel.findUnique({ where: { id } });
    return model ? PrismaUserMapper.toDomain(model) : null;
  }
}
