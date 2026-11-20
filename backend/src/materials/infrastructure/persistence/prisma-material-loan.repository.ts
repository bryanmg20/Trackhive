import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MaterialLoan } from '../../domain/entities/material-loan.entity';
import { MaterialInUseError } from '../../domain/errors/material-in-use.error';
import { MaterialNotAvailableForDeliveryError } from '../../domain/errors/material-not-available-for-delivery.error';
import { MaterialNotFoundError } from '../../domain/errors/material-not-found.error';
import { MaterialNotInUseError } from '../../domain/errors/material-not-in-use.error';
import type {
  IMaterialLoanRepository,
  MaterialLoanHistoryCriteria,
  MaterialLoanHistoryResult,
  MaterialLoanRecord,
  ReturnActiveLoanParams,
} from '../../domain/repositories/material-loan.repository';
import { PrismaMaterialLoanMapper } from '../mappers/prisma-material-loan.mapper';

const PERSON_NAME_SELECT = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  secondLastName: true,
} as const;

const LOAN_RECORD_SELECT = {
  id: true,
  materialId: true,
  handedOverAt: true,
  deliveryNotes: true,
  returnedAt: true,
  returnNotes: true,
  material: {
    select: {
      catalogCode: true,
      title: true,
      status: true,
    },
  },
  appointment: {
    select: {
      id: true,
      appointmentDate: true,
      request: {
        select: {
          id: true,
          trackingCode: true,
        },
      },
      requester: {
        select: PERSON_NAME_SELECT,
      },
    },
  },
  handedOverBy: {
    select: PERSON_NAME_SELECT,
  },
  returnedBy: {
    select: PERSON_NAME_SELECT,
  },
} satisfies Prisma.MaterialLoanModelSelect;

@Injectable()
export class PrismaMaterialLoanRepository implements IMaterialLoanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async deliverMaterial(loan: MaterialLoan): Promise<MaterialLoanRecord> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.materialModel.updateMany({
        where: { id: loan.materialId, status: 'DISPONIBLE' },
        data: PrismaMaterialLoanMapper.toMaterialInUseUpdate(loan),
      });

      if (updated.count === 0) {
        const current = await tx.materialModel.findUnique({
          where: { id: loan.materialId },
          select: { status: true },
        });
        if (!current) {
          throw new MaterialNotFoundError();
        }
        if (current.status === 'EN_USO') {
          throw new MaterialInUseError(
            'El material ya se encuentra en uso actualmente.',
          );
        }
        throw new MaterialNotAvailableForDeliveryError(current.status);
      }

      try {
        const created = await tx.materialLoanModel.create({
          data: PrismaMaterialLoanMapper.toCreatePersistence(loan),
          select: LOAN_RECORD_SELECT,
        });
        return PrismaMaterialLoanMapper.toRecord(created);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new MaterialInUseError(
            'El material ya se encuentra en uso actualmente.',
          );
        }
        throw error;
      }
    });
  }

  async returnActiveLoan(
    params: ReturnActiveLoanParams,
  ): Promise<MaterialLoanRecord> {
    return this.prisma.$transaction(async (tx) => {
      const openRow = await tx.materialLoanModel.findFirst({
        where: { materialId: params.materialId, returnedAt: null },
        orderBy: { handedOverAt: 'desc' },
      });
      if (!openRow) {
        throw new MaterialNotInUseError();
      }

      const closedLoan = PrismaMaterialLoanMapper.toDomain(
        openRow,
      ).registerReturn(params.returnedById, params.returnNotes, params.now);

      const { count } = await tx.materialLoanModel.updateMany({
        where: { id: closedLoan.id, returnedAt: null },
        data: PrismaMaterialLoanMapper.toReturnUpdate(closedLoan),
      });
      if (count === 0) {
        throw new MaterialNotInUseError();
      }

      await tx.materialModel.updateMany({
        where: { id: params.materialId },
        data: PrismaMaterialLoanMapper.toMaterialAvailableUpdate(closedLoan),
      });

      const updated = await tx.materialLoanModel.findUniqueOrThrow({
        where: { id: closedLoan.id },
        select: LOAN_RECORD_SELECT,
      });
      return PrismaMaterialLoanMapper.toRecord(updated);
    });
  }

  async findMaterialHistory(
    criteria: MaterialLoanHistoryCriteria,
  ): Promise<MaterialLoanHistoryResult> {
    const where: Prisma.MaterialLoanModelWhereInput = {
      materialId: criteria.materialId,
    };
    const orderBy: Prisma.MaterialLoanModelOrderByWithRelationInput[] = [
      { handedOverAt: 'desc' },
      { id: 'asc' },
    ];

    const [rows, total, latestRow] = await this.prisma.$transaction([
      this.prisma.materialLoanModel.findMany({
        where,
        orderBy,
        skip: (criteria.page - 1) * criteria.limit,
        take: criteria.limit,
        select: LOAN_RECORD_SELECT,
      }),
      this.prisma.materialLoanModel.count({ where }),
      this.prisma.materialLoanModel.findFirst({
        where,
        orderBy,
        select: LOAN_RECORD_SELECT,
      }),
    ]);

    return {
      items: rows.map((row) => PrismaMaterialLoanMapper.toRecord(row)),
      lastLoan: latestRow ? PrismaMaterialLoanMapper.toRecord(latestRow) : null,
      total,
    };
  }
}
