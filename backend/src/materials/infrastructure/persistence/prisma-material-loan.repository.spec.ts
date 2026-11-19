import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { MaterialLoan } from '../../domain/entities/material-loan.entity';
import { MaterialInUseError } from '../../domain/errors/material-in-use.error';
import { MaterialNotAvailableForDeliveryError } from '../../domain/errors/material-not-available-for-delivery.error';
import { MaterialNotFoundError } from '../../domain/errors/material-not-found.error';
import { MaterialNotInUseError } from '../../domain/errors/material-not-in-use.error';
import { PrismaMaterialLoanRepository } from './prisma-material-loan.repository';

const STAFF_1 = {
  id: 'staff-1',
  firstName: 'Ana',
  middleName: null,
  lastName: 'Gómez',
  secondLastName: null,
};

const STAFF_2 = {
  id: 'staff-2',
  firstName: 'Luis',
  middleName: 'Carlos',
  lastName: 'Díaz',
  secondLastName: null,
};

const REQUESTER = {
  id: 'requester-1',
  firstName: 'Juan',
  middleName: null,
  lastName: 'Pérez',
  secondLastName: null,
};

const buildLoanRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'loan-1',
  materialId: 'material-1',
  handedOverAt: new Date('2026-11-19T14:00:00Z'),
  deliveryNotes: 'Entregado en sala',
  returnedAt: null,
  returnNotes: null,
  material: {
    catalogCode: 'TH-DOC-0001',
    title: 'Acta del Cabildo de 1810',
    status: 'EN_USO',
  },
  appointment: {
    id: 'appointment-1',
    appointmentDate: new Date('2026-11-19T00:00:00Z'),
    request: { id: 'request-1', trackingCode: 'SOL-2026-00001' },
    requester: REQUESTER,
  },
  handedOverBy: STAFF_1,
  returnedBy: null,
  ...overrides,
});

describe('PrismaMaterialLoanRepository (HU-72)', () => {
  const LOAN = MaterialLoan.deliver({
    id: 'loan-1',
    materialId: 'material-1',
    appointmentId: 'appointment-1',
    handedOverById: 'staff-1',
    deliveryNotes: 'Entregado en sala',
    now: new Date('2026-11-19T14:00:00Z'),
  });

  describe('deliverMaterial', () => {
    it('updates material to EN_USO and creates the loan in one transaction', async () => {
      const tx = {
        materialModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn(),
        },
        materialLoanModel: {
          create: jest.fn().mockResolvedValue(buildLoanRow()),
        },
      };
      const prisma = {
        $transaction: jest.fn((cb: (c: typeof tx) => unknown) => cb(tx)),
      };
      const repo = new PrismaMaterialLoanRepository(
        prisma as unknown as PrismaService,
      );

      const saved = await repo.deliverMaterial(LOAN);

      expect(tx.materialModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'material-1', status: 'DISPONIBLE' },
        data: expect.objectContaining({
          status: 'EN_USO',
          statusChangedById: 'staff-1',
        }) as unknown,
      });
      expect(saved.materialStatus).toBe('EN_USO');
      expect(saved.requester.name).toBe('Juan Pérez');
      expect(saved.handedOverBy.name).toBe('Ana Gómez');
    });

    it('throws MaterialInUseError when the material is already EN_USO or P2002 fires', async () => {
      const tx = {
        materialModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUnique: jest.fn().mockResolvedValue({ status: 'EN_USO' }),
        },
        materialLoanModel: { create: jest.fn() },
      };
      const prisma = {
        $transaction: jest.fn((cb: (c: typeof tx) => unknown) => cb(tx)),
      };
      const repo = new PrismaMaterialLoanRepository(
        prisma as unknown as PrismaService,
      );

      await expect(repo.deliverMaterial(LOAN)).rejects.toThrow(
        MaterialInUseError,
      );

      tx.materialModel.updateMany.mockResolvedValue({ count: 1 });
      tx.materialLoanModel.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );
      await expect(repo.deliverMaterial(LOAN)).rejects.toThrow(
        MaterialInUseError,
      );
    });

    it('throws MaterialNotFoundError or MaterialNotAvailableForDeliveryError when unavailable', async () => {
      const tx = {
        materialModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        materialLoanModel: { create: jest.fn() },
      };
      const prisma = {
        $transaction: jest.fn((cb: (c: typeof tx) => unknown) => cb(tx)),
      };
      const repo = new PrismaMaterialLoanRepository(
        prisma as unknown as PrismaService,
      );

      await expect(repo.deliverMaterial(LOAN)).rejects.toThrow(
        MaterialNotFoundError,
      );

      tx.materialModel.findUnique.mockResolvedValue({
        status: 'EN_RESTAURACION',
      });
      await expect(repo.deliverMaterial(LOAN)).rejects.toThrow(
        MaterialNotAvailableForDeliveryError,
      );
    });
  });

  describe('returnActiveLoan', () => {
    it('closes the open loan and restores the material to DISPONIBLE', async () => {
      const returnedAt = new Date('2026-11-19T16:00:00Z');
      const tx = {
        materialLoanModel: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'loan-1',
            materialId: 'material-1',
            appointmentId: 'appointment-1',
            handedOverAt: new Date('2026-11-19T14:00:00Z'),
            handedOverById: 'staff-1',
            deliveryNotes: null,
            returnedAt: null,
            returnedById: null,
            returnNotes: null,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(
            buildLoanRow({
              returnedAt,
              returnNotes: 'Sin novedad',
              returnedBy: STAFF_2,
              material: {
                catalogCode: 'TH-DOC-0001',
                title: 'Acta del Cabildo de 1810',
                status: 'DISPONIBLE',
              },
            }),
          ),
        },
        materialModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const prisma = {
        $transaction: jest.fn((cb: (c: typeof tx) => unknown) => cb(tx)),
      };
      const repo = new PrismaMaterialLoanRepository(
        prisma as unknown as PrismaService,
      );

      const saved = await repo.returnActiveLoan({
        materialId: 'material-1',
        returnedById: 'staff-2',
        returnNotes: 'Sin novedad',
        now: returnedAt,
      });

      expect(tx.materialModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'material-1' },
        data: expect.objectContaining({
          status: 'DISPONIBLE',
          statusChangedById: 'staff-2',
        }) as unknown,
      });
      expect(saved.materialStatus).toBe('DISPONIBLE');
      expect(saved.returnedBy?.name).toBe('Luis Carlos Díaz');
    });

    it('throws MaterialNotInUseError when no open loan exists', async () => {
      const tx = {
        materialLoanModel: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const prisma = {
        $transaction: jest.fn((cb: (c: typeof tx) => unknown) => cb(tx)),
      };
      const repo = new PrismaMaterialLoanRepository(
        prisma as unknown as PrismaService,
      );

      await expect(
        repo.returnActiveLoan({
          materialId: 'material-1',
          returnedById: 'staff-2',
          returnNotes: null,
        }),
      ).rejects.toThrow(MaterialNotInUseError);
    });
  });

  describe('findMaterialHistory', () => {
    it('returns paginated items and the latest loan ordered by handedOverAt desc', async () => {
      const row = buildLoanRow();
      const prisma = {
        materialLoanModel: {
          findMany: jest.fn(),
          count: jest.fn(),
          findFirst: jest.fn(),
        },
        $transaction: jest.fn().mockResolvedValue([[row], 1, row]),
      };
      const repo = new PrismaMaterialLoanRepository(
        prisma as unknown as PrismaService,
      );

      const result = await repo.findMaterialHistory({
        materialId: 'material-1',
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.lastLoan?.id).toBe('loan-1');
    });
  });
});
