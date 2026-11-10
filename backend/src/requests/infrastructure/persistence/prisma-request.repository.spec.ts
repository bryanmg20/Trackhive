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

  describe('list (HU-12)', () => {
    const buildListPrisma = () => ({
      requestModel: {
        findMany: jest.fn().mockReturnValue('find-many'),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([
        [
          {
            id: 'request-1',
            trackingCode: 'SOL-2026-00001',
            status: 'RECIBIDA',
            deliveryMode: 'PRESENCIAL',
            desiredDate: new Date('2026-12-01T00:00:00.000Z'),
            registeredAt: new Date('2026-11-10T15:00:00.000Z'),
            requester: {
              firstName: 'Juan',
              middleName: null,
              lastName: 'Pérez',
              secondLastName: null,
              email: 'juan@mail.com',
            },
            items: [
              {
                material: {
                  id: 'material-1',
                  catalogCode: 'TH-DOC-0001',
                  title: 'Acta',
                },
              },
            ],
          },
        ],
        1,
      ]),
    });

    const baseCriteria = {
      sort: 'registeredAt' as const,
      order: 'desc' as const,
      page: 3,
      limit: 10,
    };

    it('applies no filter when the criteria only has order and page', async () => {
      const prisma = buildListPrisma();

      const result = await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).list(baseCriteria);

      expect(prisma.requestModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: [{ registeredAt: 'desc' }, { id: 'asc' }],
          skip: 20,
          take: 10,
        }),
      );
      expect(prisma.requestModel.count).toHaveBeenCalledWith({ where: {} });
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        trackingCode: 'SOL-2026-00001',
        materials: [
          { id: 'material-1', catalogCode: 'TH-DOC-0001', title: 'Acta' },
        ],
      });
    });

    it('filters by status and by an inclusive desired date range', async () => {
      const prisma = buildListPrisma();

      await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).list({
        ...baseCriteria,
        status: 'AGENDADA',
        desiredFrom: '2026-12-01',
        desiredTo: '2026-12-31',
      });

      expect(prisma.requestModel.count).toHaveBeenCalledWith({
        where: {
          AND: [
            { status: 'AGENDADA' },
            {
              desiredDate: {
                gte: new Date('2026-12-01T00:00:00.000Z'),
                lte: new Date('2026-12-31T00:00:00.000Z'),
              },
            },
          ],
        },
      });
    });

    it('requires every word of the requester text to match some field', async () => {
      const prisma = buildListPrisma();

      await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).list({ ...baseCriteria, requester: 'juan  pérez' });

      const [countArgs] = prisma.requestModel.count.mock.calls as [
        [{ where: { AND: { requester: { OR: unknown[] } }[] } }],
      ];
      const { where } = countArgs[0];
      expect(where.AND).toHaveLength(2);
      expect(where.AND[0].requester.OR).toContainEqual({
        firstName: { contains: 'juan', mode: 'insensitive' },
      });
      expect(where.AND[1].requester.OR).toContainEqual({
        lastName: { contains: 'pérez', mode: 'insensitive' },
      });
    });

    it('filters by the title or catalog code of a requested material', async () => {
      const prisma = buildListPrisma();

      await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).list({ ...baseCriteria, material: 'cabildo' });

      expect(prisma.requestModel.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              items: {
                some: {
                  material: {
                    OR: [
                      { title: { contains: 'cabildo', mode: 'insensitive' } },
                      {
                        catalogCode: {
                          contains: 'cabildo',
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      });
    });
  });
});
