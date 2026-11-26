import { Prisma } from '@prisma/client';
import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import type { PrismaService } from '../../../prisma/prisma.service';
import { Request } from '../../domain/entities/request.entity';
import { AppointmentHasLoansError } from '../../domain/errors/appointment-has-loans.error';
import { AppointmentHasUnreturnedMaterialsError } from '../../domain/errors/appointment-has-unreturned-materials.error';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import { RoomCapacityExceededError } from '../../domain/errors/room-capacity-exceeded.error';
import type { StatusChange } from '../../domain/value-objects/status-change';
import { PrismaRequestRepository } from './prisma-request.repository';

const MATERIAL_ID = 'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc';

describe('PrismaRequestRepository', () => {
  describe('save (HU-09, HU-10)', () => {
    it('inserts the new request with one item per material and its first history row', async () => {
      const create = jest.fn().mockResolvedValue({});
      const repository = new PrismaRequestRepository({
        requestModel: { create },
      } as unknown as PrismaService);
      const request = Request.create(
        {
          id: 'request-1',
          trackingCode: 'SOL-2026-00001',
          requesterId: 'requester-1',
          createdById: 'staff-1',
          originChannel: 'PRESENCIAL',
          deliveryMode: 'PRESENCIAL',
          reason: 'Consulta para un trabajo de investigación',
          desiredDate: '2026-12-01',
          materialIds: [MATERIAL_ID],
        },
        new Date('2026-11-02T12:00:00.000Z'),
      );

      await repository.save(request);

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'request-1',
          trackingCode: 'SOL-2026-00001',
          requesterId: 'requester-1',
          createdById: 'staff-1',
          originChannel: 'PRESENCIAL',
          status: 'RECIBIDA',
          requirementDescription: 'Consulta para un trabajo de investigación',
          desiredDate: new Date('2026-12-01T00:00:00.000Z'),
          items: {
            create: [
              expect.objectContaining({
                materialId: MATERIAL_ID,
                itemStatus: 'PENDIENTE',
              }),
            ],
          },
          // HU-17: the history starts with RECIBIDA and who registered it
          statusHistory: {
            create: {
              previousStatus: null,
              newStatus: 'RECIBIDA',
              userId: 'staff-1',
            },
          },
        }) as unknown,
      });
    });
  });

  describe('findById (HU-15)', () => {
    const repositoryWith = (found: unknown) =>
      new PrismaRequestRepository({
        requestModel: { findUnique: jest.fn().mockResolvedValue(found) },
      } as unknown as PrismaService);
    const row = (status: string) => ({
      id: 'request-1',
      trackingCode: 'SOL-2026-00001',
      requesterId: 'requester-1',
      createdById: 'staff-1',
      originChannel: 'PRESENCIAL',
      status,
      deliveryMode: 'PRESENCIAL',
      reason: 'Consulta',
      requirementDescription: 'Consulta',
      desiredDate: new Date('2026-12-01T00:00:00.000Z'),
      rejectionReason: null,
      items: [
        {
          materialId: MATERIAL_ID,
          material: { digitalPath: null, status: 'DISPONIBLE' },
        },
      ],
      references: [
        {
          id: 'reference-1',
          kind: 'TEXTO_LIBRE',
          notary: null,
          deedYear: null,
          deedNumber: null,
          description: 'El Heraldo, 15-03-1950',
          status: 'PENDIENTE',
          materialId: null,
        },
      ],
    });

    it('loads the written references with the entity, so its rules see them (HU-09.2)', async () => {
      const findUnique = jest.fn().mockResolvedValue(row('EN_BUSQUEDA'));
      const repository = new PrismaRequestRepository({
        requestModel: { findUnique },
      } as unknown as PrismaService);

      const request = await repository.findById('request-1');

      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            references: expect.anything() as unknown,
          }) as unknown,
        }),
      );
      expect(request?.hasPendingReferences).toBe(true);
      expect(request?.commentRequiredFor).toEqual(['DISPONIBLE', 'RECHAZADA']);
    });

    it('returns the domain entity with its status, delivery mode and materials', async () => {
      const request = await repositoryWith(row('AGENDADA')).findById(
        'request-1',
      );

      expect(request).toBeInstanceOf(Request);
      expect(request?.status).toBe('AGENDADA');
      expect(request?.allowedTransitions).toEqual(['DISPONIBLE', 'ATENDIDA']);
      expect(request?.registration?.materialIds).toEqual([MATERIAL_ID]);
    });

    describe('digital copy of the materials (HU-139)', () => {
      const COPY_PATH =
        'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Periódicos\\La Gaceta Ribereña - 1931 a 1933';

      // A digital RECIBIDA request without references and these materials
      const digitalRow = (
        materials: { digitalPath: string | null; status: string }[],
      ) => ({
        ...row('RECIBIDA'),
        deliveryMode: 'DIGITAL',
        items: materials.map((material, index) => ({
          materialId: `material-${index + 1}`,
          material,
        })),
        references: [],
      });

      it('loads the digital copy and the status of each material, so the entity decides', async () => {
        const findUnique = jest.fn().mockResolvedValue(
          digitalRow([
            { digitalPath: COPY_PATH, status: 'DISPONIBLE' },
            { digitalPath: COPY_PATH, status: 'EN_RESTAURACION' },
          ]),
        );
        const repository = new PrismaRequestRepository({
          requestModel: { findUnique },
        } as unknown as PrismaService);

        const request = await repository.findById('request-1');

        expect(findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            include: expect.objectContaining({
              items: {
                select: {
                  materialId: true,
                  material: { select: { digitalPath: true, status: true } },
                },
              },
            }) as unknown,
          }),
        );
        // A material being restored still lets the copy be sent
        expect(request?.allowedTransitions).toEqual([
          'DISPONIBLE',
          'RECHAZADA',
        ]);
        expect(request?.registration?.materialIds).toEqual([
          'material-1',
          'material-2',
        ]);
      });

      it.each([
        [
          'a material without a digital copy',
          [
            { digitalPath: COPY_PATH, status: 'DISPONIBLE' },
            { digitalPath: null, status: 'DISPONIBLE' },
          ],
        ],
        [
          'a material that is not consultable',
          [{ digitalPath: COPY_PATH, status: 'NO_CONSULTABLE' }],
        ],
        [
          'a root-only drive path',
          [{ digitalPath: 'C:\\', status: 'DISPONIBLE' }],
        ],
        [
          'a bare UNC share path',
          [{ digitalPath: '\\\\servidor\\Multimedia', status: 'DISPONIBLE' }],
        ],
        [
          'a whitespace-only path',
          [{ digitalPath: '   ', status: 'DISPONIBLE' }],
        ],
      ])('keeps the search with %s', async (_case, materials) => {
        const request = await repositoryWith(digitalRow(materials)).findById(
          'request-1',
        );

        expect(request?.allowedTransitions).toEqual([
          'EN_BUSQUEDA',
          'RECHAZADA',
        ]);
      });
    });

    it('returns null when the request does not exist', async () => {
      expect(await repositoryWith(null).findById('missing')).toBeNull();
    });

    it('fails loudly when the stored status is not valid', async () => {
      await expect(
        repositoryWith(row('ROTA')).findById('request-1'),
      ).rejects.toThrow('invalid stored value');
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

    // What Request.changeStatus() derives from the statuses, as the entity does
    const buildChange = (
      overrides: Partial<StatusChange> = {},
    ): StatusChange => {
      const base = {
        requestId: 'request-1',
        previousStatus: 'AGENDADA' as const,
        newStatus: 'ATENDIDA' as const,
        changedBy: 'staff-1',
        changedAt: CHANGED_AT,
        comment: 'Asistió a la cita',
        rejectionReason: null,
        ...overrides,
      };
      return {
        attendedAt: base.newStatus === 'ATENDIDA' ? base.changedAt : null,
        closedAt: base.newStatus === 'CERRADA' ? base.changedAt : null,
        appointmentOutcome:
          base.previousStatus === 'AGENDADA'
            ? base.newStatus === 'ATENDIDA'
              ? 'CUMPLIDA'
              : 'NO_ASISTIO'
            : null,
        ...base,
      };
    };

    // Simulated interactive transaction: the callback receives the client `tx`
    const buildTransaction = (updatedRows = 1) => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        readingRoomConfigModel: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
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
          findFirst: jest.fn().mockResolvedValue({ id: 'appointment-1' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        appointmentMaterialModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        materialLoanModel: {
          count: jest.fn().mockResolvedValue(0),
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
        template: 'SOLICITUD_ATENDIDA',
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
            template: 'SOLICITUD_ATENDIDA',
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

    it('rejects AGENDADA -> DISPONIBLE (NO_ASISTIO) if the appointment already has loans (HU-72)', async () => {
      const { tx, repository } = buildTransaction();
      tx.materialLoanModel.count.mockResolvedValue(1);

      await expect(
        repository.saveStatusChange(
          buildChange({ previousStatus: 'AGENDADA', newStatus: 'DISPONIBLE' }),
          null,
        ),
      ).rejects.toThrow(AppointmentHasLoansError);
      expect(tx.requestModel.updateMany).not.toHaveBeenCalled();
    });

    it('rejects AGENDADA -> ATENDIDA if the appointment still has unreturned materials (HU-72)', async () => {
      const { tx, repository } = buildTransaction();
      tx.materialLoanModel.count.mockResolvedValue(1);

      await expect(
        repository.saveStatusChange(
          buildChange({ previousStatus: 'AGENDADA', newStatus: 'ATENDIDA' }),
          null,
        ),
      ).rejects.toThrow(AppointmentHasUnreturnedMaterialsError);
      expect(tx.requestModel.updateMany).not.toHaveBeenCalled();
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
      attendedAt: null,
      closedAt: null,
      appointmentOutcome: null,
      comment: null,
      rejectionReason: null,
    };

    const buildTransaction = (updatedRows = 1) => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        readingRoomConfigModel: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
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
          count: jest.fn().mockResolvedValue(0),
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
        template: 'SOLICITUD_AGENDADA',
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

    it('rejects under the advisory lock when the room reaches capacity', async () => {
      const { tx, repository } = buildTransaction();
      tx.readingRoomConfigModel.findUnique.mockResolvedValue({
        dailyCapacity: 2,
      });
      tx.appointmentModel.count.mockResolvedValue(2);

      await expect(
        repository.saveAppointment(CHANGE, DATE, null),
      ).rejects.toThrow(RoomCapacityExceededError);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.requestModel.updateMany).not.toHaveBeenCalled();
      expect(tx.appointmentModel.create).not.toHaveBeenCalled();
    });
  });

  describe('rescheduleAppointment and cancelAppointment (HU-21)', () => {
    const CHANGED_AT = new Date('2026-11-18T15:30:00.000Z');
    const NEW_DATE = new Date('2026-11-24T00:00:00.000Z');
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
    ];

    const RESCHEDULE_CHANGE: StatusChange = {
      requestId: 'request-1',
      previousStatus: 'AGENDADA',
      newStatus: 'AGENDADA',
      changedBy: 'staff-1',
      changedAt: CHANGED_AT,
      attendedAt: null,
      closedAt: null,
      appointmentOutcome: null,
      comment: 'Cita reprogramada del 2026-11-20 al 2026-11-24',
      rejectionReason: null,
    };

    const CANCEL_CHANGE: StatusChange = {
      requestId: 'request-1',
      previousStatus: 'AGENDADA',
      newStatus: 'DISPONIBLE',
      changedBy: 'staff-1',
      changedAt: CHANGED_AT,
      attendedAt: null,
      closedAt: null,
      appointmentOutcome: 'CANCELADA',
      comment: 'Cita del 2026-11-20 cancelada',
      rejectionReason: null,
    };

    it('updates the appointment date, booked materials, history and email in one transaction on reschedule', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        readingRoomConfigModel: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        requestModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            items: MATERIALS.map((material) => ({
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
              Promise.resolve({ id: BigInt(10), ...data, user: STAFF }),
            ),
        },
        appointmentModel: {
          count: jest.fn().mockResolvedValue(0),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'appointment-1',
            appointmentDate: NEW_DATE,
            requester: REQUESTER,
            materials: MATERIALS.map((material) => ({ material })),
          }),
        },
        appointmentMaterialModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        materialLoanModel: {
          count: jest.fn().mockResolvedValue(0),
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

      const saved = await repository.rescheduleAppointment(
        'appointment-1',
        RESCHEDULE_CHANGE,
        NEW_DATE,
        null,
      );

      expect(tx.appointmentModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'appointment-1', status: 'PROGRAMADA' },
        data: { appointmentDate: NEW_DATE, scheduledById: 'staff-1' },
      });
      expect(tx.appointmentMaterialModel.updateMany).toHaveBeenCalledWith({
        where: { appointmentId: 'appointment-1' },
        data: { bookedDate: NEW_DATE },
      });
      expect(saved.date).toEqual(NEW_DATE);
      expect(saved.statusChange).toMatchObject({
        previousStatus: 'AGENDADA',
        newStatus: 'AGENDADA',
        comment: 'Cita reprogramada del 2026-11-20 al 2026-11-24',
      });
    });

    it('marks the appointment CANCELADA, frees bookedDate and moves request to DISPONIBLE on cancel', async () => {
      const OLD_DATE = new Date('2026-11-20T00:00:00.000Z');
      const tx = {
        requestModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        statusHistoryModel: {
          create: jest
            .fn()
            .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
              Promise.resolve({ id: BigInt(11), ...data, user: STAFF }),
            ),
        },
        appointmentModel: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'appointment-1',
            appointmentDate: OLD_DATE,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        appointmentMaterialModel: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        materialLoanModel: {
          count: jest.fn().mockResolvedValue(0),
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

      const saved = await repository.cancelAppointment(
        'appointment-1',
        CANCEL_CHANGE,
        null,
      );

      expect(tx.appointmentModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'appointment-1', status: 'PROGRAMADA' },
        data: { status: 'CANCELADA' },
      });
      expect(tx.appointmentMaterialModel.updateMany).toHaveBeenCalledWith({
        where: {
          appointmentId: 'appointment-1',
          bookedDate: { not: null },
        },
        data: { bookedDate: null },
      });
      expect(saved).toEqual({
        id: 'appointment-1',
        date: OLD_DATE,
        status: 'CANCELADA',
        statusChange: {
          previousStatus: 'AGENDADA',
          newStatus: 'DISPONIBLE',
          changedAt: CHANGED_AT,
          comment: 'Cita del 2026-11-20 cancelada',
          changedBy: STAFF,
        },
      });
    });
  });
});
