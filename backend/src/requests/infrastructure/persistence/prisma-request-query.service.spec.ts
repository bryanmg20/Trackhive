import type { PrismaService } from '../../../prisma/prisma.service';
import { PrismaRequestQueryService } from './prisma-request-query.service';

describe('PrismaRequestQueryService', () => {
  const buildPrisma = (user: Record<string, unknown>) => ({
    userModel: { findFirst: jest.fn().mockResolvedValue(user) },
    requesterModel: { findFirst: jest.fn().mockResolvedValue(null) },
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

      const result = await new PrismaRequestQueryService(
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

      const result = await new PrismaRequestQueryService(
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

      const result = await new PrismaRequestQueryService(
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
            references: [],
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

      const result = await new PrismaRequestQueryService(
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

      await new PrismaRequestQueryService(
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

      await new PrismaRequestQueryService(
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

      await new PrismaRequestQueryService(
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

    it('keeps only the RECIBIDA or EN_BUSQUEDA requests with a reference to resolve (HU-09.2)', async () => {
      const prisma = buildListPrisma();

      await new PrismaRequestQueryService(
        prisma as unknown as PrismaService,
      ).list({ ...baseCriteria, pendingReferences: true });

      expect(prisma.requestModel.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              status: { in: ['RECIBIDA', 'EN_BUSQUEDA'] },
              references: { some: { status: 'PENDIENTE' } },
            },
          ],
        },
      });
    });

    describe('listByRequesterUser (HU-11)', () => {
      it("only counts and pages the requests of the user's requester", async () => {
        const prisma = buildListPrisma();

        const result = await new PrismaRequestQueryService(
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

        await new PrismaRequestQueryService(
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

        const result = await new PrismaRequestQueryService(
          prisma as unknown as PrismaService,
        ).listByRequesterUser('user-1', baseCriteria);

        expect(result.items[0]).toMatchObject({
          status: 'RECHAZADA',
          rejectionReason: 'El material está restringido',
        });
      });
    });
  });

  describe('findDetail (HU-13)', () => {
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
            // Internal: the detail only says whether there is a copy (HU-139)
            // and its leaf folder name + review status (HU-140)
            digitalPath:
              'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Correspondencia\\Telegramas\\1902',
            reviewReason: null,
          },
        },
      ],
      references: [
        {
          id: 'reference-1',
          kind: 'PROTOCOLO_NOTARIAL',
          notary: 'Notaría Primera',
          deedYear: 1950,
          deedNumber: '245',
          description: null,
          status: 'PENDIENTE',
          materialId: null,
          resolvedAt: null,
          material: null,
          resolvedBy: null,
        },
      ],
    };

    const repositoryWith = (found: unknown) => {
      const findUnique = jest.fn().mockResolvedValue(found);
      const repository = new PrismaRequestQueryService({
        requestModel: { findUnique },
      } as unknown as PrismaService);
      return { repository, findUnique };
    };

    it('loads the request with its requester and materials', async () => {
      const { repository, findUnique } = repositoryWith(model);

      const detail = await repository.findDetail('request-1');

      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        include: expect.objectContaining({
          requester: true,
          items: { include: { material: true } },
        }) as unknown,
      });
      expect(detail?.references).toEqual([
        {
          id: 'reference-1',
          kind: 'PROTOCOLO_NOTARIAL',
          notary: 'Notaría Primera',
          year: 1950,
          deedNumber: '245',
          description: null,
          status: 'PENDIENTE',
          materialId: null,
          material: null,
          resolvedAt: null,
          resolvedBy: null,
        },
      ]);
      expect(detail).toMatchObject({
        trackingCode: 'SOL-2026-00001',
        requester: { firstName: 'Juan', email: 'juan@mail.com' },
        materials: [
          {
            catalogCode: 'TH-DOC-0001',
            itemStatus: 'LOCALIZADO',
            hasDigitalCopy: true,
            digitalFolderName: '1902',
            needsReview: false,
            reviewReason: null,
          },
        ],
      });
      // The physical location no longer exists (#165)
      expect(detail?.materials[0]).not.toHaveProperty('location');
      // The path of the copy never leaves the repository (HU-134, HU-139, HU-140)
      expect(detail?.materials[0]).not.toHaveProperty('digitalPath');
    });

    it('says a material has no digital copy when its path is NULL (HU-139)', async () => {
      const { repository } = repositoryWith({
        ...model,
        items: [
          {
            ...model.items[0],
            material: { ...model.items[0].material, digitalPath: null },
          },
        ],
      });

      const detail = await repository.findDetail('request-1');

      expect(detail?.materials[0]).toMatchObject({
        hasDigitalCopy: false,
        digitalFolderName: null,
      });
    });

    it.each(['NO_PATTERN', 'DUPLICATE_CODE'] as const)(
      'maps reviewReason %s and needsReview to true (HU-140)',
      async (reviewReason) => {
        const { repository } = repositoryWith({
          ...model,
          items: [
            {
              ...model.items[0],
              material: { ...model.items[0].material, reviewReason },
            },
          ],
        });

        const detail = await repository.findDetail('request-1');

        expect(detail?.materials[0]).toMatchObject({
          needsReview: true,
          reviewReason,
        });
      },
    );

    it('throws when a stored reviewReason is invalid', async () => {
      const { repository } = repositoryWith({
        ...model,
        items: [
          {
            ...model.items[0],
            material: {
              ...model.items[0].material,
              reviewReason: 'DESCONOCIDO',
            },
          },
        ],
      });

      await expect(repository.findDetail('request-1')).rejects.toThrow(
        /invalid stored review reason/i,
      );
    });

    it('returns null when the request does not exist', async () => {
      const { repository } = repositoryWith(null);

      expect(await repository.findDetail('missing')).toBeNull();
    });
  });

  describe('findHistory (HU-17)', () => {
    const person = {
      id: 'user-1',
      firstName: 'Ana',
      middleName: null,
      lastName: 'Gómez',
      secondLastName: null,
    };

    it('loads every row oldest first and the account of the requester', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'request-1',
        trackingCode: 'SOL-2026-00001',
        requester: { userId: 'owner-1' },
        statusHistory: [
          {
            id: BigInt(7),
            previousStatus: null,
            newStatus: 'RECIBIDA',
            changedAt: new Date('2026-11-10T15:00:00.000Z'),
            comment: null,
            visibleToRequester: true,
            user: person,
          },
          {
            id: BigInt(9),
            previousStatus: 'RECIBIDA',
            newStatus: 'RECHAZADA',
            changedAt: new Date('2026-11-11T15:00:00.000Z'),
            comment: 'Fuera del alcance del archivo',
            visibleToRequester: true,
            user: person,
          },
        ],
      });

      const result = await new PrismaRequestQueryService({
        requestModel: { findUnique },
      } as unknown as PrismaService).findHistory('request-1');

      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'request-1' },
          select: expect.objectContaining({
            statusHistory: expect.objectContaining({
              orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
            }) as unknown,
          }) as unknown,
        }),
      );
      expect(result).toEqual({
        requestId: 'request-1',
        trackingCode: 'SOL-2026-00001',
        requesterUserId: 'owner-1',
        entries: [
          expect.objectContaining({
            id: '7',
            previousStatus: null,
            newStatus: 'RECIBIDA',
            changedBy: person,
          }),
          expect.objectContaining({
            id: '9',
            previousStatus: 'RECIBIDA',
            newStatus: 'RECHAZADA',
            comment: 'Fuera del alcance del archivo',
          }),
        ],
      });
    });

    it('returns null when the request does not exist', async () => {
      const result = await new PrismaRequestQueryService({
        requestModel: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService).findHistory('missing');

      expect(result).toBeNull();
    });
  });

  describe('findNotificationContext (HU-23)', () => {
    it('loads tracking code, delivery mode, requester, catalog materials without digitalPath and formatted pending references', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        trackingCode: 'SOL-2026-00042',
        deliveryMode: 'DIGITAL',
        requester: {
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@example.com',
        },
        items: [
          { material: { catalogCode: 'AHB-001', title: 'Actas de 1890' } },
        ],
        references: [
          {
            kind: 'PROTOCOLO_NOTARIAL',
            notary: 'Notaría Primera',
            deedYear: 1940,
            deedNumber: '57',
            description: null,
          },
          {
            kind: 'TEXTO_LIBRE',
            notary: null,
            deedYear: null,
            deedNumber: null,
            description: 'El Heraldo, 15-03-1950',
          },
        ],
      });
      const repository = new PrismaRequestQueryService({
        requestModel: { findUnique },
      } as unknown as PrismaService);

      const context = await repository.findNotificationContext('request-1');

      expect(context).toEqual({
        trackingCode: 'SOL-2026-00042',
        deliveryMode: 'DIGITAL',
        requester: {
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@example.com',
        },
        materials: [{ catalogCode: 'AHB-001', title: 'Actas de 1890' }],
        references: [
          'Protocolo notarial: Notaría Primera, año 1940, escritura 57',
          'El Heraldo, 15-03-1950',
        ],
      });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        select: {
          trackingCode: true,
          deliveryMode: true,
          requester: {
            select: { firstName: true, lastName: true, email: true },
          },
          items: {
            select: {
              material: { select: { catalogCode: true, title: true } },
            },
            orderBy: { material: { catalogCode: 'asc' } },
          },
          references: {
            where: { status: 'PENDIENTE' },
            select: {
              kind: true,
              notary: true,
              deedYear: true,
              deedNumber: true,
              description: true,
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
    });

    it('returns null when the request does not exist', async () => {
      const repository = new PrismaRequestQueryService({
        requestModel: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService);

      expect(await repository.findNotificationContext('missing')).toBeNull();
    });

    it('throws when deliveryMode has an invalid stored value', async () => {
      const repository = new PrismaRequestQueryService({
        requestModel: {
          findUnique: jest.fn().mockResolvedValue({
            trackingCode: 'SOL-2026-00042',
            deliveryMode: 'INVALIDA',
            requester: {
              firstName: 'Juan',
              lastName: 'Pérez',
              email: 'juan@example.com',
            },
            items: [],
            references: [],
          }),
        },
      } as unknown as PrismaService);

      await expect(
        repository.findNotificationContext('request-1'),
      ).rejects.toThrow(/invalid stored/i);
    });

    it('throws when a reference kind has an invalid stored value', async () => {
      const repository = new PrismaRequestQueryService({
        requestModel: {
          findUnique: jest.fn().mockResolvedValue({
            trackingCode: 'SOL-2026-00042',
            deliveryMode: 'PRESENCIAL',
            requester: {
              firstName: 'Juan',
              lastName: 'Pérez',
              email: 'juan@example.com',
            },
            items: [],
            references: [
              {
                kind: 'OTRO',
                notary: null,
                deedYear: null,
                deedNumber: null,
                description: 'Algo',
              },
            ],
          }),
        },
      } as unknown as PrismaService);

      await expect(
        repository.findNotificationContext('request-1'),
      ).rejects.toThrow(/invalid stored/i);
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

      const result = await new PrismaRequestQueryService(
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
          },
        ],
      });
    });

    it('filters by status, date range, requester words and material', async () => {
      const prisma = buildAppointmentsPrisma();

      await new PrismaRequestQueryService(
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

  describe('findMissingMaterialIds (RN-04)', () => {
    it('returns the ids that are not a material of the catalog, once each', async () => {
      const findMany = jest.fn().mockResolvedValue([{ id: 'material-1' }]);
      const service = new PrismaRequestQueryService({
        materialModel: { findMany },
      } as unknown as PrismaService);

      const missing = await service.findMissingMaterialIds([
        'material-1',
        'material-2',
        'material-2',
      ]);

      expect(missing).toEqual(['material-2']);
      expect(findMany).toHaveBeenCalledWith({
        where: { id: { in: ['material-1', 'material-2'] } },
        select: { id: true },
      });
    });
  });

  describe('countAppointmentLoans & countScheduledAppointmentLoansByRequest (HU-72)', () => {
    it('counts total and open loans of an appointment in one transaction', async () => {
      const count = jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1);
      const service = new PrismaRequestQueryService({
        materialLoanModel: { count },
        $transaction: jest.fn((ops: Promise<number>[]) => Promise.all(ops)),
      } as unknown as PrismaService);

      const result = await service.countAppointmentLoans('appointment-1');

      expect(result).toEqual({ totalLoans: 3, openLoans: 1 });
      expect(count).toHaveBeenNthCalledWith(1, {
        where: { appointmentId: 'appointment-1' },
      });
      expect(count).toHaveBeenNthCalledWith(2, {
        where: { appointmentId: 'appointment-1', returnedAt: null },
      });
    });

    it('counts total and open loans of the PROGRAMADA appointment of a request', async () => {
      const count = jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0);
      const service = new PrismaRequestQueryService({
        materialLoanModel: { count },
        $transaction: jest.fn((ops: Promise<number>[]) => Promise.all(ops)),
      } as unknown as PrismaService);

      const result =
        await service.countScheduledAppointmentLoansByRequest('request-1');

      expect(result).toEqual({ totalLoans: 2, openLoans: 0 });
      expect(count).toHaveBeenNthCalledWith(1, {
        where: {
          appointment: { requestId: 'request-1', status: 'PROGRAMADA' },
        },
      });
      expect(count).toHaveBeenNthCalledWith(2, {
        where: {
          appointment: { requestId: 'request-1', status: 'PROGRAMADA' },
          returnedAt: null,
        },
      });
    });
  });
});
