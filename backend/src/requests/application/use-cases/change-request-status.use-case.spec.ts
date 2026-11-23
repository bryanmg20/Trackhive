import { Logger } from '@nestjs/common';
import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import { DeliveryMode } from '../../domain/enums/delivery-mode';
import { Request } from '../../domain/entities/request.entity';
import { AppointmentHasLoansError } from '../../domain/errors/appointment-has-loans.error';
import { AppointmentHasUnreturnedMaterialsError } from '../../domain/errors/appointment-has-unreturned-materials.error';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition.error';
import { RejectionReasonRequiredError } from '../../domain/errors/rejection-reason-required.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import { RequestStatus } from '../../domain/enums/request-status';
import type { AppointmentLoanCounts } from '../../domain/policies/appointment-loans';
import type { StatusChange } from '../../domain/value-objects/status-change';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';
import type {
  RequestNotificationContext,
  IRequestQueryService,
} from '../ports/request-query.port';
import { ChangeRequestStatusUseCase } from './change-request-status.use-case';

const CONTEXT: RequestNotificationContext = {
  trackingCode: 'SOL-2026-00042',
  deliveryMode: 'PRESENCIAL',
  requester: {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@example.com',
  },
  materials: [{ catalogCode: 'AHB-001', title: 'Actas de 1890' }],
  references: [],
};

const buildRequest = (
  status: RequestStatus,
  deliveryMode: DeliveryMode = 'PRESENCIAL',
): Request => new Request({ id: 'request-1', status, deliveryMode });

// Echoes what it receives, like the database would, with the staff member's name
const savedFrom = (change: StatusChange): SavedStatusChange => ({
  previousStatus: change.previousStatus,
  newStatus: change.newStatus,
  changedAt: change.changedAt,
  comment: change.comment,
  changedBy: {
    id: change.changedBy,
    firstName: 'Ana',
    middleName: 'María',
    lastName: 'Gómez',
    secondLastName: null,
  },
});

describe('ChangeRequestStatusUseCase', () => {
  let findById: jest.Mock<Promise<Request | null>, [string]>;
  let findNotificationContext: jest.Mock<
    Promise<RequestNotificationContext | null>,
    [string]
  >;
  let saveStatusChange: jest.Mock<
    Promise<SavedStatusChange>,
    [StatusChange, NotificationDraft | null]
  >;
  let countScheduledAppointmentLoansByRequest: jest.Mock<
    Promise<AppointmentLoanCounts>,
    [string]
  >;
  let useCase: ChangeRequestStatusUseCase;

  beforeEach(() => {
    findById = jest.fn<Promise<Request | null>, [string]>(() =>
      Promise.resolve(buildRequest('AGENDADA')),
    );
    findNotificationContext = jest.fn<
      Promise<RequestNotificationContext | null>,
      [string]
    >(() => Promise.resolve(CONTEXT));
    saveStatusChange = jest.fn<
      Promise<SavedStatusChange>,
      [StatusChange, NotificationDraft | null]
    >((change) => Promise.resolve(savedFrom(change)));
    countScheduledAppointmentLoansByRequest = jest.fn(() =>
      Promise.resolve({ totalLoans: 0, openLoans: 0 }),
    );
    const repository: IRequestRepository = {
      save: jest.fn(),
      findById,
      findAppointmentById: jest.fn(),
      saveStatusChange,
      saveAppointment: jest.fn(),
      rescheduleAppointment: jest.fn(),
      cancelAppointment: jest.fn(),
      saveReferenceResolution: jest.fn(),
    };
    const queries: IRequestQueryService = {
      list: jest.fn(),
      listByRequesterUser: jest.fn(),
      findHistory: jest.fn(),
      findDetail: jest.fn(),
      listAppointments: jest.fn(),
      findRequesterByEmail: jest.fn(),
      findNotificationContext,
      findSchedulingConflicts: jest.fn(),
      findMissingMaterialIds: jest.fn(),
      countActiveAppointmentsOnDate: jest.fn(),
      countActiveAppointmentsByDateRange: jest.fn(),
      findMostRequestedMaterials: jest.fn(),
      countAppointmentLoans: jest.fn(),
      countScheduledAppointmentLoansByRequest,
    };
    useCase = new ChangeRequestStatusUseCase(repository, queries);
  });

  // The email queued with the change (HU-23)
  const queuedEmail = () => saveStatusChange.mock.calls[0][1];

  describe('emailing the requester (HU-23, HU-24)', () => {
    it('queues the email with the dedicated template, new status, and material without observations when omitted', async () => {
      await useCase.execute({
        requestId: 'request-1',
        status: 'ATENDIDA',
        userId: 'staff-1',
      });

      expect(findNotificationContext).toHaveBeenCalledWith('request-1');
      expect(saveStatusChange).toHaveBeenCalledTimes(1);
      expect(queuedEmail()).toMatchObject({
        recipientEmail: 'juan@example.com',
        template: 'SOLICITUD_ATENDIDA',
        subject: 'Su solicitud SOL-2026-00042 fue atendida',
      });
      expect(queuedEmail()?.text).toContain('Estado actual: Atendida');
      expect(queuedEmail()?.text).toContain('AHB-001 · Actas de 1890');
      expect(queuedEmail()?.text).not.toContain('Observaciones del personal');
      expect(queuedEmail()?.html).not.toContain('Observaciones del personal');
    });

    it('includes the reason once on RECHAZADA without duplicating it under Observaciones del personal', async () => {
      findById.mockResolvedValue(buildRequest('RECIBIDA'));

      await useCase.execute({
        requestId: 'request-1',
        status: 'RECHAZADA',
        comment: '  El material está restringido  ',
        userId: 'staff-1',
      });

      expect(queuedEmail()).toMatchObject({
        template: 'SOLICITUD_RECHAZADA',
        subject: 'No fue posible atender su solicitud SOL-2026-00042',
      });
      expect(queuedEmail()?.text).toContain(
        'Motivo del rechazo: El material está restringido',
      );
      expect(queuedEmail()?.text).not.toContain('Observaciones del personal');
      expect(queuedEmail()?.html).not.toContain('Observaciones del personal');
    });

    it.each<[RequestStatus, RequestStatus, string, string]>([
      [
        'RECIBIDA',
        'EN_BUSQUEDA',
        'SOLICITUD_EN_BUSQUEDA',
        'En búsqueda en depósito 2',
      ],
      [
        'EN_BUSQUEDA',
        'DISPONIBLE',
        'SOLICITUD_DISPONIBLE',
        'Disponible en formato físico',
      ],
      [
        'AGENDADA',
        'ATENDIDA',
        'SOLICITUD_ATENDIDA',
        'Consultó los tomos completos',
      ],
    ])(
      'includes staff comment under Observaciones del personal when transitioning %s -> %s (%s)',
      async (fromStatus, toStatus, expectedTemplate, comment) => {
        findById.mockResolvedValue(buildRequest(fromStatus));

        await useCase.execute({
          requestId: 'request-1',
          status: toStatus as 'EN_BUSQUEDA' | 'DISPONIBLE' | 'ATENDIDA',
          comment: `  ${comment}  `,
          userId: 'staff-1',
        });

        expect(queuedEmail()?.template).toBe(expectedTemplate);
        expect(queuedEmail()?.text).toContain(
          `Observaciones del personal:\n${comment}`,
        );
        expect(queuedEmail()?.html).toContain('Observaciones del personal:');
        expect(queuedEmail()?.html).toContain(comment);
      },
    );

    it('omits Observaciones del personal when the staff comment is whitespace-only', async () => {
      await useCase.execute({
        requestId: 'request-1',
        status: 'DISPONIBLE',
        comment: '   \n\t  ',
        userId: 'staff-1',
      });

      expect(queuedEmail()?.template).toBe('SOLICITUD_DISPONIBLE');
      expect(queuedEmail()?.text).not.toContain('Observaciones del personal');
      expect(queuedEmail()?.html).not.toContain('Observaciones del personal');
    });

    it('saves the change without an email when the requester has none, and logs it', async () => {
      findNotificationContext.mockResolvedValue({
        ...CONTEXT,
        requester: { ...CONTEXT.requester, email: null },
      });
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const result = await useCase.execute({
        requestId: 'request-1',
        status: 'ATENDIDA',
        userId: 'staff-1',
      });

      expect(result.status).toBe('ATENDIDA');
      expect(saveStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ newStatus: 'ATENDIDA' }),
        null,
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SOL-2026-00042 has no requester email'),
      );
      warnSpy.mockRestore();
    });

    it('queues nothing when the transition is not valid', async () => {
      findById.mockResolvedValue(buildRequest('RECIBIDA'));

      await expect(
        useCase.execute({
          requestId: 'request-1',
          status: 'ATENDIDA',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(InvalidStatusTransitionError);
      expect(findNotificationContext).not.toHaveBeenCalled();
      expect(saveStatusChange).not.toHaveBeenCalled();
    });
  });

  it('saves the date and time, the responsible and the comment of the change', async () => {
    const before = Date.now();

    await useCase.execute({
      requestId: 'request-1',
      status: 'ATENDIDA',
      comment: 'Consultó las actas en la sala',
      userId: 'staff-1',
    });

    expect(findById).toHaveBeenCalledWith('request-1');
    expect(saveStatusChange).toHaveBeenCalledTimes(1);
    const saved = saveStatusChange.mock.calls[0][0];
    expect(saved).toMatchObject({
      requestId: 'request-1',
      previousStatus: 'AGENDADA',
      newStatus: 'ATENDIDA',
      changedBy: 'staff-1',
      comment: 'Consultó las actas en la sala',
    });
    expect(saved.changedAt).toBeInstanceOf(Date);
    expect(saved.changedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('accepts a change without a comment', async () => {
    await useCase.execute({
      requestId: 'request-1',
      status: 'ATENDIDA',
      userId: 'staff-1',
    });

    expect(saveStatusChange.mock.calls[0][0].comment).toBeNull();
  });

  it('returns the new status, its next transitions and the saved record', async () => {
    const result = await useCase.execute({
      requestId: 'request-1',
      status: 'ATENDIDA',
      userId: 'staff-1',
    });

    expect(result).toEqual({
      id: 'request-1',
      status: 'ATENDIDA',
      allowedTransitions: ['CERRADA'],
      rejectionReason: null,
      statusChange: {
        previousStatus: 'AGENDADA',
        newStatus: 'ATENDIDA',
        changedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ) as unknown,
        changedBy: { id: 'staff-1', name: 'Ana María Gómez' },
        comment: null,
      },
    });
  });

  it('moves a scheduled request back to DISPONIBLE when the requester did not attend', async () => {
    const result = await useCase.execute({
      requestId: 'request-1',
      status: 'DISPONIBLE',
      comment: 'No asistió a la cita',
      userId: 'staff-1',
    });

    expect(result.status).toBe('DISPONIBLE');
    expect(result.allowedTransitions).toEqual(['AGENDADA', 'CERRADA']);
    expect(saveStatusChange.mock.calls[0][0]).toMatchObject({
      previousStatus: 'AGENDADA',
      newStatus: 'DISPONIBLE',
    });
  });

  describe('direct DISPONIBLE with a digital copy (HU-139)', () => {
    // As the repository loads it: digital delivery, every copy, none blocked
    const receivedWithCopies = (anyMaterialNotConsultable = false) =>
      new Request({
        id: 'request-1',
        status: 'RECIBIDA',
        deliveryMode: 'DIGITAL',
        allMaterialsHaveDigitalCopy: true,
        anyMaterialNotConsultable,
      });

    it('saves RECIBIDA -> DISPONIBLE with who did it and queues the email, like any change', async () => {
      findById.mockResolvedValue(receivedWithCopies());
      findNotificationContext.mockResolvedValue({
        ...CONTEXT,
        deliveryMode: 'DIGITAL',
      });

      const result = await useCase.execute({
        requestId: 'request-1',
        status: 'DISPONIBLE',
        userId: 'staff-1',
      });

      expect(saveStatusChange).toHaveBeenCalledTimes(1);
      expect(saveStatusChange.mock.calls[0][0]).toMatchObject({
        previousStatus: 'RECIBIDA',
        newStatus: 'DISPONIBLE',
        changedBy: 'staff-1',
        appointmentOutcome: null,
      });
      expect(queuedEmail()).toMatchObject({
        recipientEmail: 'juan@example.com',
        template: 'SOLICITUD_DISPONIBLE',
      });
      expect(queuedEmail()?.text).toContain('le enviará la copia por correo');
      expect(result).toMatchObject({
        status: 'DISPONIBLE',
        allowedTransitions: ['ATENDIDA', 'CERRADA'],
        statusChange: {
          previousStatus: 'RECIBIDA',
          newStatus: 'DISPONIBLE',
          changedBy: { id: 'staff-1', name: 'Ana María Gómez' },
        },
      });
    });

    it('refuses EN_BUSQUEDA with 409 and saves nothing when the copy was already found', async () => {
      findById.mockResolvedValue(receivedWithCopies());

      await expect(
        useCase.execute({
          requestId: 'request-1',
          status: 'EN_BUSQUEDA',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(InvalidStatusTransitionError);
      expect(saveStatusChange).not.toHaveBeenCalled();
    });

    it('refuses DISPONIBLE with 409 and saves nothing when a material is not consultable', async () => {
      findById.mockResolvedValue(receivedWithCopies(true));

      await expect(
        useCase.execute({
          requestId: 'request-1',
          status: 'DISPONIBLE',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(InvalidStatusTransitionError);
      expect(saveStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('reading-room custody loan safeguards (HU-72)', () => {
    it.each<AppointmentLoanCounts>([
      { totalLoans: 1, openLoans: 0 },
      { totalLoans: 2, openLoans: 1 },
    ])(
      'rejects AGENDADA -> DISPONIBLE (NO_ASISTIO) when the appointment has loans (%o) and does not call saveStatusChange',
      async (loanCounts) => {
        countScheduledAppointmentLoansByRequest.mockResolvedValue(loanCounts);

        await expect(
          useCase.execute({
            requestId: 'request-1',
            status: 'DISPONIBLE',
            userId: 'staff-1',
          }),
        ).rejects.toThrow(AppointmentHasLoansError);
        expect(countScheduledAppointmentLoansByRequest).toHaveBeenCalledWith(
          'request-1',
        );
        expect(saveStatusChange).not.toHaveBeenCalled();
      },
    );

    it('rejects AGENDADA -> ATENDIDA (CUMPLIDA) when the appointment has unreturned materials and does not call saveStatusChange', async () => {
      countScheduledAppointmentLoansByRequest.mockResolvedValue({
        totalLoans: 2,
        openLoans: 1,
      });

      await expect(
        useCase.execute({
          requestId: 'request-1',
          status: 'ATENDIDA',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(AppointmentHasUnreturnedMaterialsError);
      expect(countScheduledAppointmentLoansByRequest).toHaveBeenCalledWith(
        'request-1',
      );
      expect(saveStatusChange).not.toHaveBeenCalled();
    });

    it('allows AGENDADA -> ATENDIDA (CUMPLIDA) when all delivered materials have been returned', async () => {
      countScheduledAppointmentLoansByRequest.mockResolvedValue({
        totalLoans: 2,
        openLoans: 0,
      });

      const result = await useCase.execute({
        requestId: 'request-1',
        status: 'ATENDIDA',
        userId: 'staff-1',
      });

      expect(result.status).toBe('ATENDIDA');
      expect(saveStatusChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('rejecting (HU-16)', () => {
    beforeEach(() => {
      findById.mockResolvedValue(buildRequest('EN_BUSQUEDA'));
    });

    it('saves the reason as the rejection reason and the history comment', async () => {
      const result = await useCase.execute({
        requestId: 'request-1',
        status: 'RECHAZADA',
        comment: 'El material no se encontró en el archivo',
        userId: 'staff-1',
      });

      expect(saveStatusChange.mock.calls[0][0]).toMatchObject({
        previousStatus: 'EN_BUSQUEDA',
        newStatus: 'RECHAZADA',
        changedBy: 'staff-1',
        comment: 'El material no se encontró en el archivo',
        rejectionReason: 'El material no se encontró en el archivo',
      });
      expect(result).toMatchObject({
        status: 'RECHAZADA',
        rejectionReason: 'El material no se encontró en el archivo',
        // Final status: nothing else can be done
        allowedTransitions: [],
      });
    });

    it('throws RejectionReasonRequiredError and saves nothing without a reason', async () => {
      await expect(
        useCase.execute({
          requestId: 'request-1',
          status: 'RECHAZADA',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(RejectionReasonRequiredError);
      expect(saveStatusChange).not.toHaveBeenCalled();
    });
  });

  it('throws RequestNotFoundError and saves nothing when the request does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        requestId: 'missing',
        status: 'EN_BUSQUEDA',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(RequestNotFoundError);
    expect(saveStatusChange).not.toHaveBeenCalled();
  });

  it('throws InvalidStatusTransitionError and saves nothing for an invalid transition', async () => {
    findById.mockResolvedValue(buildRequest('RECIBIDA'));

    await expect(
      useCase.execute({
        requestId: 'request-1',
        status: 'ATENDIDA',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(InvalidStatusTransitionError);
    expect(saveStatusChange).not.toHaveBeenCalled();
  });

  it.each<RequestStatus>(['CERRADA', 'RECHAZADA'])(
    'does not change a request in the final status %s',
    async (finalStatus) => {
      findById.mockResolvedValue(buildRequest(finalStatus));

      await expect(
        useCase.execute({
          requestId: 'request-1',
          status: 'DISPONIBLE',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(InvalidStatusTransitionError);
      expect(saveStatusChange).not.toHaveBeenCalled();
    },
  );

  it('lets the conflict of a concurrent change reach the caller', async () => {
    saveStatusChange.mockRejectedValue(new RequestStatusConflictError());

    await expect(
      useCase.execute({
        requestId: 'request-1',
        status: 'ATENDIDA',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(RequestStatusConflictError);
  });
});
