import { Prisma } from '@prisma/client';
import type { NotificationDraft } from '../../../notifications/domain/notification-draft';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { RequesterInput } from '../../application/use-cases/create-request-on-behalf.use-case';
import { Request } from '../../domain/entities/request.entity';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import type { StatusChange } from '../../domain/status-change';
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
    const buildListPrisma = (
      overrides: { status?: string; rejectionReason?: string | null } = {},
    ) => ({
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
            rejectionReason: null,
            ...overrides,
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

    describe('listByRequesterUser (HU-11)', () => {
      it("only counts and pages the requests of the user's requester", async () => {
        const prisma = buildListPrisma();

        const result = await new PrismaRequestRepository(
          prisma as unknown as PrismaService,
        ).listByRequesterUser('user-1', baseCriteria);

        const where = { AND: [{ requester: { userId: 'user-1' } }, {}] };
        expect(prisma.requestModel.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where,
            orderBy: [{ registeredAt: 'desc' }, { id: 'asc' }],
            skip: 20,
            take: 10,
          }),
        );
        expect(prisma.requestModel.count).toHaveBeenCalledWith({ where });
        expect(result.total).toBe(1);
        expect(result.items[0]).toMatchObject({
          trackingCode: 'SOL-2026-00001',
          status: 'RECIBIDA',
        });
      });

      it('keeps the user condition when filtering by status', async () => {
        const prisma = buildListPrisma();

        await new PrismaRequestRepository(
          prisma as unknown as PrismaService,
        ).listByRequesterUser('user-1', {
          ...baseCriteria,
          status: 'AGENDADA',
        });

        expect(prisma.requestModel.count).toHaveBeenCalledWith({
          where: {
            AND: [
              { requester: { userId: 'user-1' } },
              { AND: [{ status: 'AGENDADA' }] },
            ],
          },
        });
      });

      it('returns the rejection reason of a rejected request (HU-16)', async () => {
        const prisma = buildListPrisma({
          status: 'RECHAZADA',
          rejectionReason: 'El material está restringido',
        });

        const result = await new PrismaRequestRepository(
          prisma as unknown as PrismaService,
        ).listByRequesterUser('user-1', baseCriteria);

        expect(result.items[0]).toMatchObject({
          status: 'RECHAZADA',
          rejectionReason: 'El material está restringido',
        });
      });
    });
  });

  describe('findById (HU-13)', () => {
    const model = {
      id: 'request-1',
      trackingCode: 'SOL-2026-00001',
      status: 'AGENDADA',
      deliveryMode: 'PRESENCIAL',
      originChannel: 'WEB',
      reason: 'Investigación',
      requirementDescription: 'Actas',
      desiredDate: new Date('2026-12-01T00:00:00.000Z'),
      committedDate: null,
      registeredAt: new Date('2026-11-10T15:00:00.000Z'),
      rejectionReason: null,
      requester: {
        firstName: 'Juan',
        middleName: null,
        lastName: 'Pérez',
        secondLastName: null,
        email: 'juan@mail.com',
        phone: null,
        requesterType: 'INVESTIGADOR',
        institution: null,
        documentType: null,
        documentNumber: null,
      },
      items: [
        {
          itemStatus: 'LOCALIZADO',
          material: {
            id: 'material-1',
            catalogCode: 'TH-DOC-0001',
            title: 'Acta',
            materialType: 'DOCUMENTO',
            author: null,
            collection: 'Actas del Cabildo',
            status: 'DISPONIBLE',
            depot: 'D-01',
            shelf: 'E-01',
            box: 'C-001',
          },
        },
      ],
    };

    const repositoryWith = (found: unknown) => {
      const findUnique = jest.fn().mockResolvedValue(found);
      const repository = new PrismaRequestRepository({
        requestModel: { findUnique },
      } as unknown as PrismaService);
      return { repository, findUnique };
    };

    it('loads the request with its requester and materials', async () => {
      const { repository, findUnique } = repositoryWith(model);

      const detail = await repository.findById('request-1');

      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        include: { requester: true, items: { include: { material: true } } },
      });
      expect(detail).toMatchObject({
        trackingCode: 'SOL-2026-00001',
        requester: { firstName: 'Juan', email: 'juan@mail.com' },
        materials: [
          {
            catalogCode: 'TH-DOC-0001',
            location: { depot: 'D-01', shelf: 'E-01', box: 'C-001' },
            itemStatus: 'LOCALIZADO',
          },
        ],
      });
    });

    it('returns null when the request does not exist', async () => {
      const { repository } = repositoryWith(null);

      expect(await repository.findById('missing')).toBeNull();
    });
  });

  describe('findEntityById (HU-15)', () => {
    const repositoryWith = (found: unknown) =>
      new PrismaRequestRepository({
        requestModel: { findUnique: jest.fn().mockResolvedValue(found) },
      } as unknown as PrismaService);

    it('returns the domain entity with its status and delivery mode', async () => {
      const request = await repositoryWith({
        id: 'request-1',
        status: 'AGENDADA',
        deliveryMode: 'PRESENCIAL',
        rejectionReason: null,
      }).findEntityById('request-1');

      expect(request).toBeInstanceOf(Request);
      expect(request?.status).toBe('AGENDADA');
      expect(request?.allowedTransitions).toEqual(['DISPONIBLE', 'ATENDIDA']);
    });

    it('returns null when the request does not exist', async () => {
      expect(await repositoryWith(null).findEntityById('missing')).toBeNull();
    });

    it('fails loudly when the stored status is not valid', async () => {
      await expect(
        repositoryWith({
          id: 'request-1',
          status: 'ROTA',
          deliveryMode: 'PRESENCIAL',
          rejectionReason: null,
        }).findEntityById('request-1'),
      ).rejects.toThrow('invalid stored value');
    });
  });

  describe('findNotificationContext (HU-23)', () => {
    it('loads the tracking code, the requester and the materials in catalog order', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        trackingCode: 'SOL-2026-00042',
        requester: {
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@example.com',
        },
        items: [
          { material: { catalogCode: 'AHB-001', title: 'Actas de 1890' } },
        ],
      });
      const repository = new PrismaRequestRepository({
        requestModel: { findUnique },
      } as unknown as PrismaService);

      const context = await repository.findNotificationContext('request-1');

      expect(context).toEqual({
        trackingCode: 'SOL-2026-00042',
        requester: {
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@example.com',
        },
        materials: [{ catalogCode: 'AHB-001', title: 'Actas de 1890' }],
      });
      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'request-1' },
          select: expect.objectContaining({
            items: expect.objectContaining({
              orderBy: { material: { catalogCode: 'asc' } },
            }) as unknown,
          }) as unknown,
        }),
      );
    });

    it('returns null when the request does not exist', async () => {
      const repository = new PrismaRequestRepository({
        requestModel: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService);

      expect(await repository.findNotificationContext('missing')).toBeNull();
    });
  });

  describe('saveStatusChange (HU-15)', () => {
    const CHANGED_AT = new Date('2026-11-10T15:30:00.000Z');
    const STAFF = {
      id: 'staff-1',
      firstName: 'Ana',
      middleName: null,
      lastName: 'Gómez',
      secondLastName: null,
    };

    const buildChange = (
      overrides: Partial<StatusChange> = {},
    ): StatusChange => ({
      requestId: 'request-1',
      previousStatus: 'AGENDADA',
      newStatus: 'ATENDIDA',
      changedBy: 'staff-1',
      changedAt: CHANGED_AT,
      comment: 'Asistió a la cita',
      rejectionReason: null,
      ...overrides,
    });

    // Simulated interactive transaction: the callback receives the client `tx`
    const buildTransaction = (updatedRows = 1) => {
      const tx = {
        requestModel: {
          updateMany: jest.fn().mockResolvedValue({ count: updatedRows }),
        },
        statusHistoryModel: {
          create: jest
            .fn()
            .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
              Promise.resolve({ id: BigInt(1), ...data, user: STAFF }),
            ),
        },
        appointmentModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        appointmentMaterialModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        notificationModel: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      const prisma = {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
      };
      const repository = new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      );
      return { tx, prisma, repository };
    };

    describe('queuing the email to the requester (HU-23)', () => {
      const EMAIL: NotificationDraft = {
        recipientEmail: 'juan@example.com',
        template: 'CAMBIO_ESTADO',
        subject: 'Su solicitud SOL-2026-00042 pasó a «Atendida»',
        text: 'Nuevo estado: Atendida',
        html: '<p>Nuevo estado: <strong>Atendida</strong></p>',
      };

      it('queues it PENDIENTE in the same transaction, linked to its history row', async () => {
        const { prisma, tx, repository } = buildTransaction();

        await repository.saveStatusChange(buildChange(), EMAIL);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.notificationModel.create).toHaveBeenCalledWith({
          data: {
            id: expect.any(String) as string,
            requestId: 'request-1',
            // The id of the status_history row created just before
            statusHistoryId: BigInt(1),
            recipientEmail: 'juan@example.com',
            template: 'CAMBIO_ESTADO',
            subject: 'Su solicitud SOL-2026-00042 pasó a «Atendida»',
            body: 'Nuevo estado: Atendida',
            htmlBody: '<p>Nuevo estado: <strong>Atendida</strong></p>',
            deliveryStatus: 'PENDIENTE',
            // Ready to send as soon as the job runs
            scheduledAt: CHANGED_AT,
          },
        });
      });

      it('queues nothing when the requester has no email', async () => {
        const { tx, repository } = buildTransaction();

        await repository.saveStatusChange(buildChange(), null);

        expect(tx.statusHistoryModel.create).toHaveBeenCalledTimes(1);
        expect(tx.notificationModel.create).not.toHaveBeenCalled();
      });

      it('queues nothing when someone else changed the status first', async () => {
        const { tx, repository } = buildTransaction(0);

        await expect(
          repository.saveStatusChange(buildChange(), EMAIL),
        ).rejects.toThrow(RequestStatusConflictError);
        expect(tx.notificationModel.create).not.toHaveBeenCalled();
      });

      it('lets a failure to queue it undo the whole change', async () => {
        const { tx, repository } = buildTransaction();
        tx.notificationModel.create.mockRejectedValue(new Error('db down'));

        // The rejection makes Prisma roll back the transaction: no status
        // change is left without its email
        await expect(
          repository.saveStatusChange(buildChange(), EMAIL),
        ).rejects.toThrow('db down');
      });
    });

    it('saves the status and the history row in one transaction', async () => {
      const { prisma, tx, repository } = buildTransaction();

      await repository.saveStatusChange(buildChange(), null);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.requestModel.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.statusHistoryModel.create).toHaveBeenCalledTimes(1);
    });

    it('only updates the request if it is still in the previous status', async () => {
      const { tx, repository } = buildTransaction();

      await repository.saveStatusChange(buildChange(), null);

      expect(tx.requestModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'request-1', status: 'AGENDADA' },
        data: {
          status: 'ATENDIDA',
          version: { increment: 1 },
          attendedAt: CHANGED_AT,
        },
      });
    });

    it('stores the previous and new status, date, responsible and comment', async () => {
      const { tx, repository } = buildTransaction();

      await repository.saveStatusChange(buildChange(), null);

      expect(tx.statusHistoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            requestId: 'request-1',
            previousStatus: 'AGENDADA',
            newStatus: 'ATENDIDA',
            userId: 'staff-1',
            comment: 'Asistió a la cita',
            changedAt: CHANGED_AT,
          },
        }),
      );
    });

    it('sets the closing date when the request is closed', async () => {
      const { tx, repository } = buildTransaction();

      await repository.saveStatusChange(
        buildChange({ previousStatus: 'ATENDIDA', newStatus: 'CERRADA' }),
        null,
      );

      expect(tx.requestModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: 'CERRADA',
            version: { increment: 1 },
            closedAt: CHANGED_AT,
          },
        }),
      );
    });

    it('saves the rejection reason when the request is rejected (HU-16)', async () => {
      const { tx, repository } = buildTransaction();

      await repository.saveStatusChange(
        buildChange({
          previousStatus: 'RECIBIDA',
          newStatus: 'RECHAZADA',
          comment: 'El material está restringido',
          rejectionReason: 'El material está restringido',
        }),
        null,
      );

      expect(tx.requestModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'request-1', status: 'RECIBIDA' },
        data: {
          status: 'RECHAZADA',
          version: { increment: 1 },
          rejectionReason: 'El material está restringido',
        },
      });
      // The reason is also the comment of the history row (docs/modelo-datos.md)
      expect(tx.statusHistoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            newStatus: 'RECHAZADA',
            comment: 'El material está restringido',
          }) as unknown,
        }),
      );
    });

    it('sets no attention or closing date when the requester did not attend', async () => {
      const { tx, repository } = buildTransaction();

      await repository.saveStatusChange(
        buildChange({ newStatus: 'DISPONIBLE', comment: null }),
        null,
      );

      expect(tx.requestModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'DISPONIBLE', version: { increment: 1 } },
        }),
      );
    });

    it('returns the saved row with the name of the responsible', async () => {
      const { repository } = buildTransaction();

      const saved = await repository.saveStatusChange(buildChange(), null);

      expect(saved).toEqual({
        previousStatus: 'AGENDADA',
        newStatus: 'ATENDIDA',
        changedAt: CHANGED_AT,
        comment: 'Asistió a la cita',
        changedBy: STAFF,
      });
    });

    it('throws RequestStatusConflictError and writes no history when someone changed it first', async () => {
      const { tx, repository } = buildTransaction(0);

      await expect(
        repository.saveStatusChange(buildChange(), null),
      ).rejects.toThrow(RequestStatusConflictError);
      expect(tx.statusHistoryModel.create).not.toHaveBeenCalled();
    });

    // Leaving AGENDADA settles the appointment, so it can be scheduled again (HU-18)
    it.each([
      ['ATENDIDA', 'CUMPLIDA'],
      ['DISPONIBLE', 'NO_ASISTIO'],
    ] as const)(
      'marks the scheduled appointment as %s -> %s',
      async (newStatus, appointmentStatus) => {
        const { tx, repository } = buildTransaction();

        await repository.saveStatusChange(buildChange({ newStatus }), null);

        expect(tx.appointmentModel.updateMany).toHaveBeenCalledWith({
          where: { requestId: 'request-1', status: 'PROGRAMADA' },
          data: { status: appointmentStatus },
        });
        // The day of its materials is free again (HU-20)
        expect(tx.appointmentMaterialModel.updateMany).toHaveBeenCalledWith({
          where: {
            appointment: {
              requestId: 'request-1',
              status: { not: 'PROGRAMADA' },
            },
            bookedDate: { not: null },
          },
          data: { bookedDate: null },
        });
      },
    );

    it('does not touch appointments when the request was not scheduled', async () => {
      const { tx, repository } = buildTransaction();

      await repository.saveStatusChange(
        buildChange({ previousStatus: 'ATENDIDA', newStatus: 'CERRADA' }),
        null,
      );

      expect(tx.appointmentModel.updateMany).not.toHaveBeenCalled();
      expect(tx.appointmentMaterialModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('saveAppointment (HU-18)', () => {
    const CHANGED_AT = new Date('2026-11-10T15:30:00.000Z');
    const DATE = new Date('2026-11-20T00:00:00.000Z');
    const STAFF = {
      id: 'staff-1',
      firstName: 'Ana',
      middleName: null,
      lastName: 'Gómez',
      secondLastName: null,
    };
    const REQUESTER = {
      id: 'requester-1',
      firstName: 'Juan',
      middleName: null,
      lastName: 'Pérez',
      secondLastName: null,
    };
    const MATERIALS = [
      { id: 'material-1', catalogCode: 'AHB-001', title: 'Actas de 1890' },
      { id: 'material-2', catalogCode: 'AHB-002', title: 'El Heraldo, 1935' },
    ];

    const CHANGE: StatusChange = {
      requestId: 'request-1',
      previousStatus: 'DISPONIBLE',
      newStatus: 'AGENDADA',
      changedBy: 'staff-1',
      changedAt: CHANGED_AT,
      comment: null,
      rejectionReason: null,
    };

    const buildTransaction = (updatedRows = 1) => {
      const tx = {
        requestModel: {
          updateMany: jest.fn().mockResolvedValue({ count: updatedRows }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            requesterId: 'requester-1',
            items: MATERIALS.map((material) => ({
              materialId: material.id,
              material: {
                catalogCode: material.catalogCode,
                title: material.title,
              },
            })),
          }),
        },
        statusHistoryModel: {
          create: jest
            .fn()
            .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
              Promise.resolve({ id: BigInt(1), ...data, user: STAFF }),
            ),
        },
        appointmentModel: {
          create: jest.fn().mockResolvedValue({
            id: 'appointment-1',
            appointmentDate: DATE,
            requester: REQUESTER,
            materials: MATERIALS.map((material) => ({ material })),
          }),
        },
        notificationModel: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      const prisma = {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
        // What findSchedulingConflicts reads when the race is asked again
        requestModel: {
          findUnique: jest.fn().mockResolvedValue({
            items: MATERIALS.map((material) => ({
              material: { ...material, status: 'DISPONIBLE' },
            })),
          }),
        },
        appointmentModel: {
          findMany: jest.fn().mockResolvedValue([
            {
              appointmentDate: DATE,
              request: { trackingCode: 'SOL-2026-00042' },
              materials: [{ material: MATERIALS[0] }],
            },
          ]),
        },
      };
      const repository = new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      );
      return { tx, prisma, repository };
    };

    it('queues the email of the appointment in the same transaction (HU-23)', async () => {
      const { prisma, tx, repository } = buildTransaction();

      await repository.saveAppointment(CHANGE, DATE, {
        recipientEmail: 'juan@example.com',
        template: 'CAMBIO_ESTADO',
        subject: 'Su solicitud SOL-2026-00042 pasó a «Agendada»',
        text: 'Fecha de la cita: viernes, 20 de noviembre de 2026',
        html: '<p>Fecha de la cita</p>',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.notificationModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: 'request-1',
          statusHistoryId: BigInt(1),
          recipientEmail: 'juan@example.com',
          body: 'Fecha de la cita: viernes, 20 de noviembre de 2026',
          deliveryStatus: 'PENDIENTE',
        }) as unknown,
      });
      expect(tx.appointmentModel.create).toHaveBeenCalledTimes(1);
    });

    it('saves AGENDADA, its history row and the appointment in one transaction', async () => {
      const { prisma, tx, repository } = buildTransaction();

      await repository.saveAppointment(CHANGE, DATE, null);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.requestModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'request-1', status: 'DISPONIBLE' },
        data: { status: 'AGENDADA', version: { increment: 1 } },
      });
      expect(tx.statusHistoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousStatus: 'DISPONIBLE',
            newStatus: 'AGENDADA',
            userId: 'staff-1',
          }) as unknown,
        }),
      );
    });

    it('creates the appointment for the day with the requester and every material', async () => {
      const { tx, repository } = buildTransaction();

      await repository.saveAppointment(CHANGE, DATE, null);

      expect(tx.appointmentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            id: expect.any(String) as string,
            requestId: 'request-1',
            requesterId: 'requester-1',
            scheduledById: 'staff-1',
            appointmentDate: DATE,
            status: 'PROGRAMADA',
            materials: {
              create: [
                { materialId: 'material-1', bookedDate: DATE },
                { materialId: 'material-2', bookedDate: DATE },
              ],
            },
          },
        }),
      );
    });

    it('returns the saved appointment with names and materials', async () => {
      const { repository } = buildTransaction();

      const saved = await repository.saveAppointment(CHANGE, DATE, null);

      expect(saved).toEqual({
        id: 'appointment-1',
        date: DATE,
        status: 'PROGRAMADA',
        requester: REQUESTER,
        materials: MATERIALS,
        statusChange: {
          previousStatus: 'DISPONIBLE',
          newStatus: 'AGENDADA',
          changedAt: CHANGED_AT,
          comment: null,
          changedBy: STAFF,
        },
      });
    });

    it('creates no appointment when someone changed the status first', async () => {
      const { tx, repository } = buildTransaction(0);

      await expect(
        repository.saveAppointment(CHANGE, DATE, null),
      ).rejects.toThrow(RequestStatusConflictError);
      expect(tx.statusHistoryModel.create).not.toHaveBeenCalled();
      expect(tx.appointmentModel.create).not.toHaveBeenCalled();
      expect(tx.notificationModel.create).not.toHaveBeenCalled();
    });

    it('answers the race on the day with the concrete conflict (HU-20)', async () => {
      const { prisma, tx, repository } = buildTransaction();
      // The unique index of (material_id, booked_date) rejected the insert:
      // another staff member booked the same material the same day first
      tx.appointmentModel.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`material_id`,`booked_date`)',
          { code: 'P2002', clientVersion: '6.19.3' },
        ),
      );

      await expect(
        repository.saveAppointment(CHANGE, DATE, null),
      ).rejects.toThrow(MaterialAlreadyBookedError);
      expect(prisma.appointmentModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PROGRAMADA' }) as unknown,
        }) as unknown,
      );
      await expect(
        repository.saveAppointment(CHANGE, DATE, null),
      ).rejects.toThrow(
        'El material «Actas de 1890» (AHB-001) ya tiene cita el viernes, ' +
          '20 de noviembre de 2026 (solicitud SOL-2026-00042).',
      );
    });

    it('lets other database failures through', async () => {
      const { tx, repository } = buildTransaction();
      tx.appointmentModel.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key failed', {
          code: 'P2003',
          clientVersion: '6.19.3',
        }),
      );

      await expect(
        repository.saveAppointment(CHANGE, DATE, null),
      ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
    });
  });

  describe('listAppointments (HU-19)', () => {
    const buildAppointmentsPrisma = () => ({
      appointmentModel: {
        findMany: jest.fn().mockReturnValue('find-many'),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([
        [
          {
            id: 'appointment-1',
            appointmentDate: new Date('2026-11-20T00:00:00.000Z'),
            status: 'PROGRAMADA',
            notes: null,
            createdAt: new Date('2026-11-10T15:00:00.000Z'),
            request: {
              id: 'request-1',
              trackingCode: 'SOL-2026-00001',
              status: 'AGENDADA',
              deliveryMode: 'PRESENCIAL',
            },
            requester: {
              id: 'requester-1',
              firstName: 'Juan',
              middleName: null,
              lastName: 'Pérez',
              secondLastName: null,
              email: 'juan@mail.com',
              phone: '3001234567',
              requesterType: 'INVESTIGADOR',
              institution: null,
              documentType: 'CC',
              documentNumber: '123456789',
            },
            scheduledBy: {
              id: 'staff-1',
              firstName: 'Ana',
              middleName: null,
              lastName: 'Gómez',
              secondLastName: null,
            },
            materials: [
              {
                material: {
                  id: 'material-1',
                  catalogCode: 'TH-DOC-0001',
                  title: 'Acta de fundación de la villa',
                  materialType: 'DOCUMENTO',
                  depot: 'D-01',
                  shelf: 'E-01',
                  box: 'C-001',
                },
              },
            ],
          },
        ],
        1,
      ]),
    });

    const baseCriteria = {
      sort: 'appointmentDate' as const,
      order: 'asc' as const,
      page: 2,
      limit: 10,
    };

    it('lists and counts appointments in one transaction with pagination and order', async () => {
      const prisma = buildAppointmentsPrisma();

      const result = await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).listAppointments(baseCriteria);

      expect(prisma.appointmentModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: [{ appointmentDate: 'asc' }, { id: 'asc' }],
          skip: 10,
          take: 10,
        }),
      );
      expect(prisma.appointmentModel.count).toHaveBeenCalledWith({ where: {} });
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'appointment-1',
        status: 'PROGRAMADA',
        request: { trackingCode: 'SOL-2026-00001' },
        materials: [
          {
            id: 'material-1',
            catalogCode: 'TH-DOC-0001',
            title: 'Acta de fundación de la villa',
            depot: 'D-01',
          },
        ],
      });
    });

    it('filters by status, date range, requester words and material', async () => {
      const prisma = buildAppointmentsPrisma();

      await new PrismaRequestRepository(
        prisma as unknown as PrismaService,
      ).listAppointments({
        ...baseCriteria,
        status: 'PROGRAMADA',
        from: '2026-11-01',
        to: '2026-11-30',
        requester: 'juan pérez',
        material: 'cabildo',
      });

      const [countArgs] = prisma.appointmentModel.count.mock.calls as [
        [{ where: { AND: unknown[] } }],
      ];
      expect(countArgs[0].where.AND).toEqual([
        { status: 'PROGRAMADA' },
        {
          appointmentDate: {
            gte: new Date('2026-11-01T00:00:00.000Z'),
            lte: new Date('2026-11-30T00:00:00.000Z'),
          },
        },
        expect.objectContaining({
          requester: {
            OR: expect.arrayContaining([
              { firstName: { contains: 'juan', mode: 'insensitive' } },
            ]) as unknown,
          },
        }),
        expect.objectContaining({
          requester: {
            OR: expect.arrayContaining([
              { lastName: { contains: 'pérez', mode: 'insensitive' } },
            ]) as unknown,
          },
        }),
        {
          materials: {
            some: {
              material: {
                OR: [
                  { title: { contains: 'cabildo', mode: 'insensitive' } },
                  { catalogCode: { contains: 'cabildo', mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ]);
    });
  });
});
