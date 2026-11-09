import type { PrismaService } from '../../../prisma/prisma.service';
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
    userModel: { findUniqueOrThrow: jest.fn().mockResolvedValue(user) },
    requesterModel: {
      findUnique: jest.fn().mockResolvedValue(existingRequester),
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
});
