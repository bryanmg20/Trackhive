import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  IMaterialRepository,
  MaterialSearchCriteria,
  MaterialSearchResult,
} from '../../domain/repositories/material.repository';
import { PrismaMaterialMapper } from '../mappers/prisma-material.mapper';

@Injectable()
export class PrismaMaterialRepository implements IMaterialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    criteria: MaterialSearchCriteria,
  ): Promise<MaterialSearchResult> {
    const where = this.buildWhere(criteria);
    const orderBy = this.buildOrderBy(criteria);

    // Same filter for the page and the total, in one transaction
    const [models, total] = await this.prisma.$transaction([
      this.prisma.materialModel.findMany({
        where,
        orderBy,
        skip: (criteria.page - 1) * criteria.limit,
        take: criteria.limit,
      }),
      this.prisma.materialModel.count({ where }),
    ]);

    return {
      items: models.map((model) => PrismaMaterialMapper.toDomain(model)),
      total,
    };
  }

  private buildWhere(
    criteria: MaterialSearchCriteria,
  ): Prisma.MaterialModelWhereInput {
    const where: Prisma.MaterialModelWhereInput = {};

    if (criteria.q) {
      // contains + insensitive becomes ILIKE '%q%', served by the trigram indexes
      const text = { contains: criteria.q, mode: 'insensitive' as const };
      where.OR = [
        { title: text },
        { author: text },
        { catalogCode: text },
        { collection: text },
      ];
    }
    if (criteria.type) {
      where.materialType = criteria.type;
    }
    if (criteria.collection) {
      where.collection = criteria.collection;
    }
    if (criteria.status) {
      where.status = criteria.status;
    }
    return where;
  }

  private buildOrderBy(
    criteria: MaterialSearchCriteria,
  ): Prisma.MaterialModelOrderByWithRelationInput[] {
    const { sort, order } = criteria;
    // Materials without author always go at the end, in both directions
    const primary: Prisma.MaterialModelOrderByWithRelationInput =
      sort === 'author'
        ? { author: { sort: order, nulls: 'last' } }
        : { [sort]: order };
    // Tie-breaker so pages do not repeat or skip rows
    return [primary, { id: 'asc' }];
  }
}
