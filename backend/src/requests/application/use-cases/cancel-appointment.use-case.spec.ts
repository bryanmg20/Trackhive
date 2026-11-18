import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import { Request } from '../../domain/entities/request.entity';
import type { AppointmentStatus } from '../../domain/enums/appointment-status';
import type { RequestStatus } from '../../domain/enums/request-status';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error';
import { AppointmentNotScheduledError } from '../../domain/errors/appointment-not-scheduled.error';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type {
  SavedCancelledAppointment,
  StoredAppointment,
} from '../../domain/value-objects/saved-appointment';
import type { StatusChange } from '../../domain/value-objects/status-change';
import type {
  IRequestQueryService,
  RequestNotificationContext,
} from '../ports/request-query.port';
import { CancelAppointmentUseCase } from './cancel-appointment.use-case';

const storedAppointment = (
  appointmentStatus: AppointmentStatus = 'PROGRAMADA',
  requestStatus: RequestStatus = 'AGENDADA',
): StoredAppointment => ({
  id: 'appointment-1',
  date: new Date('2026-11-20T00:00:00.000Z'),
  status: appointmentStatus,
  request: new Request({
    id: 'request-1',
    status: requestStatus,
    deliveryMode: 'PRESENCIAL',
  }),
});

const savedFrom = (change: StatusChange): SavedCancelledAppointment => ({
  id: 'appointment-1',
  date: new Date('2026-11-20T00:00:00.000Z'),
  status: 'CANCELADA',
  statusChange: {
    previousStatus: change.previousStatus,
    newStatus: change.newStatus,
    changedAt: change.changedAt,
    comment: change.comment,
    changedBy: {
      id: change.changedBy,
      firstName: 'Ana',
      middleName: null,
      lastName: 'Gómez',
      secondLastName: null,
    },
  },
});

describe('CancelAppointmentUseCase (HU-21)', () => {
  let findAppointmentById: jest.Mock<
    Promise<StoredAppointment | null>,
    [string]
  >;
  let cancelAppointment: jest.Mock<
    Promise<SavedCancelledAppointment>,
    [string, StatusChange, NotificationDraft | null]
  >;
  let useCase: CancelAppointmentUseCase;

  const CONTEXT: RequestNotificationContext = {
    trackingCode: 'SOL-2026-00042',
    requester: {
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
    },
    materials: [{ catalogCode: 'AHB-001', title: 'Actas de 1890' }],
  };

  beforeEach(() => {
    findAppointmentById = jest.fn(() => Promise.resolve(storedAppointment()));
    cancelAppointment = jest.fn((_id, change) =>
      Promise.resolve(savedFrom(change)),
    );

    const repository: IRequestRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAppointmentById,
      saveStatusChange: jest.fn(),
      saveAppointment: jest.fn(),
      rescheduleAppointment: jest.fn(),
      cancelAppointment,
    };
    const queries: IRequestQueryService = {
      list: jest.fn(),
      listByRequesterUser: jest.fn(),
      findHistory: jest.fn(),
      findDetail: jest.fn(),
      listAppointments: jest.fn(),
      findRequesterByEmail: jest.fn(),
      findNotificationContext: jest.fn(() => Promise.resolve(CONTEXT)),
      findSchedulingConflicts: jest.fn(),
      findMissingMaterialIds: jest.fn(),
      countActiveAppointmentsOnDate: jest.fn(),
      countActiveAppointmentsByDateRange: jest.fn(),
    };
    useCase = new CancelAppointmentUseCase(repository, queries);
  });

  it('cancels a PROGRAMADA appointment, moves the request back to DISPONIBLE, records the history change and queues an email', async () => {
    const result = await useCase.execute({
      appointmentId: 'appointment-1',
      userId: 'staff-1',
    });

    expect(cancelAppointment).toHaveBeenCalledTimes(1);
    const [appointmentId, change, email] = cancelAppointment.mock.calls[0];
    expect(appointmentId).toBe('appointment-1');
    expect(change).toMatchObject({
      requestId: 'request-1',
      previousStatus: 'AGENDADA',
      newStatus: 'DISPONIBLE',
      changedBy: 'staff-1',
      comment: 'Cita del 2026-11-20 cancelada',
      appointmentOutcome: 'CANCELADA',
    });
    expect(email).toMatchObject({
      recipientEmail: 'juan@example.com',
      subject: 'Su solicitud SOL-2026-00042 pasó a «Disponible»',
    });
    expect(result).toMatchObject({
      id: 'request-1',
      status: 'DISPONIBLE',
      allowedTransitions: ['AGENDADA', 'CERRADA'],
      appointment: {
        id: 'appointment-1',
        date: '2026-11-20',
        status: 'CANCELADA',
      },
      statusChange: {
        previousStatus: 'AGENDADA',
        newStatus: 'DISPONIBLE',
        comment: 'Cita del 2026-11-20 cancelada',
      },
    });
  });

  it('uses a custom cancellation comment when provided', async () => {
    await useCase.execute({
      appointmentId: 'appointment-1',
      comment: '  Cancelada por cambio de último momento  ',
      userId: 'staff-1',
    });

    expect(cancelAppointment.mock.calls[0][1].comment).toBe(
      'Cancelada por cambio de último momento',
    );
  });

  it('throws AppointmentNotFoundError when the appointment does not exist', async () => {
    findAppointmentById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        appointmentId: 'missing',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it.each<AppointmentStatus>(['CANCELADA', 'CUMPLIDA', 'NO_ASISTIO'])(
    'rejects an appointment already in %s',
    async (status) => {
      findAppointmentById.mockResolvedValue(storedAppointment(status));

      await expect(
        useCase.execute({
          appointmentId: 'appointment-1',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(AppointmentNotScheduledError);
      expect(cancelAppointment).not.toHaveBeenCalled();
    },
  );

  it('rejects when the request is no longer AGENDADA', async () => {
    findAppointmentById.mockResolvedValue(
      storedAppointment('PROGRAMADA', 'DISPONIBLE'),
    );

    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(InvalidStatusTransitionError);
    expect(cancelAppointment).not.toHaveBeenCalled();
  });
});
