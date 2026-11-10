import type { PrismaService } from '../../../prisma/prisma.service';
import type { RequesterInput } from '../../application/use-cases/create-request-on-behalf.use-case';
import { PrismaRequestRepository } from './prisma-request.repository';

const MATERIAL_ID = 'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc';

/**
 * The e2e tests run without a database, so this unit test checks with a
 * simulated Prisma that a user's first request creates their requester with
 * the same four name fields as the account (issue #96).
 */
describe('PrismaRequestRepository', () => {
  const buildPrisma = (
    user: Record<string, unknown>,
    existingRequester: { id: string } | null = null,
  ) => ({
    userModel: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue(user),
      findFirst: jest.fn().mockResolvedValue(user),
    },
    requesterModel: {
      findUnique: jest.fn().mockResolvedValue(existingRequester),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'requester-1' }),
    },
    materialModel: {
      findMany: jest.fn().mockResolvedValue([{ id: MATERIAL_ID }]),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ value: BigInt(1) }]),
    requestModel: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'request-1', trackingCode: 'SOL-2026-00001' }),
    },
  });

  const createRequest = (prisma: ReturnType<typeof buildPrisma>) =>
    new PrismaRequestRepository(prisma as unknown as PrismaService).create({
      createdById: 'user-1',
      materialIds: [MATERIAL_ID],
      reason: 'Consulta para un trabajo de investigación',
      desiredDate: '2026-12-01',
      deliveryMode: 'PRESENCIAL',
    });

  it("copies the user's four name fields to their new requester", async () => {
    const prisma = buildPrisma({
      id: 'user-1',
      firstName: 'Juan',
      middleName: 'Carlos',
      lastName: 'Pérez',
      secondLastName: 'Gómez',
      email: 'juan@mail.com',
    });

    await createRequest(prisma);

    expect(prisma.requesterModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        firstName: 'Juan',
        middleName: 'Carlos',
        lastName: 'Pérez',
        secondLastName: 'Gómez',
        email: 'juan@mail.com',
      }) as unknown,
    });
  });

  it('keeps the optional name fields null when the user has none', async () => {
    const prisma = buildPrisma({
      id: 'user-1',
      firstName: 'Ana',
      middleName: null,
      lastName: 'Pérez',
      secondLastName: null,
      email: 'ana@mail.com',
    });

    await createRequest(prisma);

    expect(prisma.requesterModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Ana',
        middleName: null,
        lastName: 'Pérez',
        secondLastName: null,
      }) as unknown,
    });
  });

  it('reuses the requester of a user who already has one', async () => {
    const prisma = buildPrisma(
      {
        id: 'user-1',
        firstName: 'Ana',
        middleName: null,
        lastName: 'Pérez',
        secondLastName: null,
        email: 'ana@mail.com',
      },
      { id: 'requester-1' },
    );

    await createRequest(prisma);

    expect(prisma.requesterModel.create).not.toHaveBeenCalled();
    expect(prisma.requestModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requesterId: 'requester-1' }) as unknown,
    });
  });

  describe('createOnBehalf', () => {
    const createOnBehalf = (
      prisma: ReturnType<typeof buildPrisma>,
      requester: RequesterInput,
    ) =>
      new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).createOnBehalf({
        createdById: 'staff-1',
        materialIds: [MATERIAL_ID],
        reason: 'Consulta para un trabajo de investigación',
        desiredDate: '2026-12-01',
        deliveryMode: 'PRESENCIAL',
        requester,
      });

    it('creates a visitor requester without an account', async () => {
      const prisma = buildPrisma({});
      prisma.userModel.findFirst.mockResolvedValue(null);

      await createOnBehalf(prisma, {
        email: 'Visitante@Ejemplo.com',
        firstName: 'Visitante',
        lastName: 'Prueba',
        phone: '3001234567',
      });

      expect(prisma.requesterModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          email: 'visitante@ejemplo.com',
          firstName: 'Visitante',
          lastName: 'Prueba',
          requesterType: 'CIUDADANO',
        }) as unknown,
      });
      expect(prisma.requestModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          createdById: 'staff-1',
          originChannel: 'PRESENCIAL',
          status: 'RECIBIDA',
        }) as unknown,
      });
    });

    it('reuses an existing requester found by email', async () => {
      const prisma = buildPrisma({});
      prisma.requesterModel.findFirst.mockResolvedValue({
        id: 'requester-existing',
      });

      await createOnBehalf(prisma, {
        email: 'visitante@ejemplo.com',
        firstName: 'Otro',
        lastName: 'Nombre',
      });

      expect(prisma.requesterModel.create).not.toHaveBeenCalled();
      expect(prisma.requestModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requesterId: 'requester-existing',
        }) as unknown,
      });
    });

    it('associates an existing user by id', async () => {
      const prisma = buildPrisma({
        id: 'user-visitor',
        firstName: 'Ana',
        middleName: null,
        lastName: 'Pérez',
        secondLastName: null,
        email: 'ana@mail.com',
      });
      prisma.requesterModel.findUnique.mockResolvedValue(null);

      await createOnBehalf(prisma, {
        email: 'ana@mail.com',
        userId: 'user-visitor',
      });

      expect(prisma.requesterModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-visitor',
          firstName: 'Ana',
          lastName: 'Pérez',
        }) as unknown,
      });
    });
  });

  describe('findRequesterByEmail', () => {
    it('returns a requester when it exists', async () => {
      const prisma = buildPrisma({});
      prisma.requesterModel.findFirst.mockResolvedValue({
        id: 'requester-1',
        userId: null,
        firstName: 'Visitante',
        middleName: null,
        lastName: 'Prueba',
        secondLastName: null,
        email: 'visitante@ejemplo.com',
        phone: null,
        requesterType: 'CIUDADANO',
        institution: null,
        documentType: null,
        documentNumber: null,
      });

      const result = await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).findRequesterByEmail('visitante@ejemplo.com');

      expect(result).toMatchObject({
        requesterId: 'requester-1',
        email: 'visitante@ejemplo.com',
        foundIn: 'REQUESTER',
      });
    });

    it('falls back to a user when there is no requester', async () => {
      const prisma = buildPrisma({
        id: 'user-1',
        firstName: 'Ana',
        middleName: null,
        lastName: 'Pérez',
        secondLastName: null,
        email: 'ana@mail.com',
      });
      prisma.requesterModel.findFirst.mockResolvedValue(null);

      const result = await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).findRequesterByEmail('ana@mail.com');

      expect(result).toMatchObject({
        requesterId: null,
        userId: 'user-1',
        email: 'ana@mail.com',
        foundIn: 'USER',
      });
    });

    it('returns null when the email is unknown', async () => {
      const prisma = buildPrisma({});
      prisma.requesterModel.findFirst.mockResolvedValue(null);
      prisma.userModel.findFirst.mockResolvedValue(null);

      const result = await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).findRequesterByEmail('nadie@ejemplo.com');

      expect(result).toBeNull();
    });
  });
});
