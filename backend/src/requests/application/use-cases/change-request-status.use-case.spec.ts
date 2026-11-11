import { Logger } from '@nestjs/common';
import type { NotificationDraft } from '../../../notifications/domain/notification-draft';
import { DeliveryMode } from '../../domain/delivery-mode';
import { Request } from '../../domain/entities/request.entity';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition.error';
import { RejectionReasonRequiredError } from '../../domain/errors/rejection-reason-required.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import { RequestStatus } from '../../domain/request-status';
import type { StatusChange } from '../../domain/status-change';
import type {
  RequestNotificationContext,
  RequestRepository,
  SavedStatusChange,
} from '../ports/request.repository.port';
import { ChangeRequestStatusUseCase } from './change-request-status.use-case';

const CONTEXT: RequestNotificationContext = {
  trackingCode: 'SOL-2026-00042',
  requester: {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@example.com',
  },
  materials: [{ catalogCode: 'AHB-001', title: 'Actas de 1890' }],
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
  let findEntityById: jest.Mock<Promise<Request | null>, [string]>;
  let findNotificationContext: jest.Mock<
    Promise<RequestNotificationContext | null>,
    [string]
  >;
  let saveStatusChange: jest.Mock<
    Promise<SavedStatusChange>,
    [StatusChange, NotificationDraft | null]
  >;
  let useCase: ChangeRequestStatusUseCase;

  beforeEach(() => {
    findEntityById = jest.fn<Promise<Request | null>, [string]>(() =>
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
    const repository: RequestRepository = {
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn(),
      list: jest.fn(),
      listAppointments: jest.fn(),
      findById: jest.fn(),
      listByRequesterUser: jest.fn(),
      findEntityById,
      findNotificationContext,
      findSchedulingConflicts: jest.fn(),
      saveStatusChange,
      saveAppointment: jest.fn(),
    };
    useCase = new ChangeRequestStatusUseCase(repository);
  });

  // The email queued with the change (HU-23)
  const queuedEmail = () => saveStatusChange.mock.calls[0][1];

  describe('emailing the requester (HU-23)', () => {
    it('queues the email with the new status and the material in the same save', async () => {
      await useCase.execute({
        requestId: 'request-1',
        status: 'ATENDIDA',
        userId: 'staff-1',
      });

      expect(findNotificationContext).toHaveBeenCalledWith('request-1');
      expect(saveStatusChange).toHaveBeenCalledTimes(1);
      expect(queuedEmail()).toMatchObject({
        recipientEmail: 'juan@example.com',
        template: 'CAMBIO_ESTADO',
        subject: 'Su solicitud SOL-2026-00042 pasó a «Atendida»',
      });
      expect(queuedEmail()?.text).toContain('Nuevo estado: Atendida');
      expect(queuedEmail()?.text).toContain('AHB-001 · Actas de 1890');
    });

    it('includes the reason when the request is rejected', async () => {
      findEntityById.mockResolvedValue(buildRequest('RECIBIDA'));

      await useCase.execute({
        requestId: 'request-1',
        status: 'RECHAZADA',
        comment: '  El material está restringido  ',
        userId: 'staff-1',
      });

      expect(queuedEmail()?.text).toContain(
        'Motivo del rechazo: El material está restringido',
      );
    });

    it('does not show an ordinary comment, which can be an internal note', async () => {
      await useCase.execute({
        requestId: 'request-1',
        status: 'DISPONIBLE',
        comment: 'Nota interna del personal',
        userId: 'staff-1',
      });

      expect(queuedEmail()?.text).not.toContain('Nota interna');
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
      findEntityById.mockResolvedValue(buildRequest('RECIBIDA'));

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

    expect(findEntityById).toHaveBeenCalledWith('request-1');
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

  describe('rejecting (HU-16)', () => {
    beforeEach(() => {
      findEntityById.mockResolvedValue(buildRequest('EN_BUSQUEDA'));
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
    findEntityById.mockResolvedValue(null);

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
    findEntityById.mockResolvedValue(buildRequest('RECIBIDA'));

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
      findEntityById.mockResolvedValue(buildRequest(finalStatus));

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
