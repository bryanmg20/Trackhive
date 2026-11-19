import { Prisma } from '@prisma/client';
import { MaterialLoan } from '../../domain/entities/material-loan.entity';
import { InvalidMaterialStatusError } from '../../domain/errors/invalid-material-status.error';
import { isMaterialStatus } from '../../domain/enums/material-status';
import type { MaterialLoanRecord } from '../../domain/repositories/material-loan.repository';

interface PersonNameParts {
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
}

export interface PrismaMaterialLoanRow {
  id: string;
  materialId: string;
  handedOverAt: Date;
  deliveryNotes: string | null;
  returnedAt: Date | null;
  returnNotes: string | null;
  material: {
    catalogCode: string;
    title: string;
    status: string;
  };
  appointment: {
    id: string;
    appointmentDate: Date;
    request: {
      id: string;
      trackingCode: string;
    };
    requester: { id: string } & PersonNameParts;
  };
  handedOverBy: { id: string } & PersonNameParts;
  returnedBy: ({ id: string } & PersonNameParts) | null;
}

export interface PrismaOpenLoanRow {
  id: string;
  materialId: string;
  appointmentId: string;
  handedOverAt: Date;
  handedOverById: string;
  deliveryNotes: string | null;
  returnedAt: Date | null;
  returnedById: string | null;
  returnNotes: string | null;
}

function formatFullName(parts: PersonNameParts): string {
  return [
    parts.firstName,
    parts.middleName,
    parts.lastName,
    parts.secondLastName,
  ]
    .filter((part): part is string => Boolean(part && part.trim() !== ''))
    .join(' ');
}

export class PrismaMaterialLoanMapper {
  static toDomain(row: PrismaOpenLoanRow): MaterialLoan {
    return new MaterialLoan({
      id: row.id,
      materialId: row.materialId,
      appointmentId: row.appointmentId,
      handedOverAt: row.handedOverAt,
      handedOverById: row.handedOverById,
      deliveryNotes: row.deliveryNotes,
      returnedAt: row.returnedAt,
      returnedById: row.returnedById,
      returnNotes: row.returnNotes,
    });
  }

  static toCreatePersistence(
    loan: MaterialLoan,
  ): Prisma.MaterialLoanModelUncheckedCreateInput {
    return {
      id: loan.id,
      materialId: loan.materialId,
      appointmentId: loan.appointmentId,
      handedOverAt: loan.handedOverAt,
      handedOverById: loan.handedOverById,
      deliveryNotes: loan.deliveryNotes,
      returnedAt: null,
      returnedById: null,
      returnNotes: null,
    };
  }

  static toReturnUpdate(
    loan: MaterialLoan,
  ): Prisma.MaterialLoanModelUncheckedUpdateManyInput {
    return {
      returnedAt: loan.returnedAt,
      returnedById: loan.returnedById,
      returnNotes: loan.returnNotes,
    };
  }

  static toMaterialInUseUpdate(
    loan: MaterialLoan,
  ): Prisma.MaterialModelUncheckedUpdateManyInput {
    return {
      status: 'EN_USO',
      statusChangedAt: loan.handedOverAt,
      statusChangedById: loan.handedOverById,
      statusChangeReason: loan.deliveryNotes,
    };
  }

  static toMaterialAvailableUpdate(
    loan: MaterialLoan,
  ): Prisma.MaterialModelUncheckedUpdateManyInput {
    return {
      status: 'DISPONIBLE',
      statusChangedAt: loan.returnedAt,
      statusChangedById: loan.returnedById,
      statusChangeReason: loan.returnNotes,
    };
  }

  static toRecord(row: PrismaMaterialLoanRow): MaterialLoanRecord {
    if (!isMaterialStatus(row.material.status)) {
      throw new InvalidMaterialStatusError();
    }
    return {
      id: row.id,
      materialId: row.materialId,
      materialCatalogCode: row.material.catalogCode,
      materialTitle: row.material.title,
      materialStatus: row.material.status,
      appointment: {
        id: row.appointment.id,
        date: row.appointment.appointmentDate,
        requestId: row.appointment.request.id,
        trackingCode: row.appointment.request.trackingCode,
      },
      requester: {
        id: row.appointment.requester.id,
        name: formatFullName(row.appointment.requester),
      },
      handedOverAt: row.handedOverAt,
      handedOverBy: {
        id: row.handedOverBy.id,
        name: formatFullName(row.handedOverBy),
      },
      deliveryNotes: row.deliveryNotes,
      returnedAt: row.returnedAt,
      returnedBy: row.returnedBy
        ? {
            id: row.returnedBy.id,
            name: formatFullName(row.returnedBy),
          }
        : null,
      returnNotes: row.returnNotes,
    };
  }
}
