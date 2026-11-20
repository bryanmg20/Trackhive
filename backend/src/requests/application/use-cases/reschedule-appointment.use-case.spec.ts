import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import { Request } from '../../domain/entities/request.entity';
import type { AppointmentStatus } from '../../domain/enums/appointment-status';
import type { RequestStatus } from '../../domain/enums/request-status';
import { AppointmentHasLoansError } from '../../domain/errors/appointment-has-loans.error';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error';
import { AppointmentNotScheduledError } from '../../domain/errors/appointment-not-scheduled.error';
import { InvalidAppointmentDateError } from '../../domain/errors/invalid-appointment-date.error';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition.error';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { MaterialNotAvailableError } from '../../domain/errors/material-not-available.error';
import { RoomCapacityExceededError } from '../../domain/errors/room-capacity-exceeded.error';
import type { AppointmentLoanCounts } from '../../domain/policies/appointment-loans';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import type { RoomCapacityConfig } from '../../domain/value-objects/room-capacity';
import type {
  SavedAppointment,
  StoredAppointment,
} from '../../domain/value-objects/saved-appointment';
import type { StatusChange } from '../../domain/value-objects/status-change';
import type {
  IRequestQueryService,
  RequestNotificationContext,
  SchedulingConflicts,
} from '../ports/request-query.port';
import { RescheduleAppointmentUseCase } from './reschedule-appointment.use-case';

const MATERIALS = [
  { id: 'material-1', catalogCode: 'AHB-001', title: 'Actas de 1890' },
];

const SCHEDULABLE: SchedulingConflicts = {
  materials: MATERIALS.map((material) => ({
    ...material,
    status: 'DISPONIBLE',
  })),
  bookedMaterials: [],
};

const storedAppointment = (
  appointmentStatus: AppointmentStatus = 'PROGRAMADA',
  requestStatus: RequestStatus = 'AGENDADA',
  date = '2026-11-20',
): StoredAppointment => ({
  id: 'appointment-1',
  date: new Date(`${date}T00:00:00.000Z`),
  status: appointmentStatus,
  materialIds: ['material-1'],
  request: new Request({
    id: 'request-1',
    status: requestStatus,
    deliveryMode: 'PRESENCIAL',
  }),
});

const savedFrom = (change: StatusChange, date: Date): SavedAppointment => ({
  id: 'appointment-1',
  date,
  status: 'PROGRAMADA',
  requester: {
    id: 'requester-1',
    firstName: 'Juan',
    middleName: null,
    lastName: 'Pérez',
    secondLastName: null,
  },
  materials: MATERIALS,
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

describe('RescheduleAppointmentUseCase (HU-21)', () => {
  let findAppointmentById: jest.Mock<
    Promise<StoredAppointment | null>,
    [string]
  >;
  let findSchedulingConflicts: jest.Mock<
    Promise<SchedulingConflicts>,
    [string, Date]
  >;
  let rescheduleAppointment: jest.Mock<
    Promise<SavedAppointment>,
    [string, StatusChange, Date, NotificationDraft | null]
  >;
  let getCapacityConfig: jest.Mock<Promise<RoomCapacityConfig>, []>;
  let countActiveAppointmentsOnDate: jest.Mock<Promise<number>, [Date]>;
  let countAppointmentLoans: jest.Mock<
    Promise<AppointmentLoanCounts>,
    [string]
  >;
  let useCase: RescheduleAppointmentUseCase;

  const CONTEXT: RequestNotificationContext = {
    trackingCode: 'SOL-2026-00042',
    requester: {
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
    },
    materials: MATERIALS,
  };

  beforeEach(() => {
    findAppointmentById = jest.fn(() => Promise.resolve(storedAppointment()));
    findSchedulingConflicts = jest.fn(() => Promise.resolve(SCHEDULABLE));
    rescheduleAppointment = jest.fn((_id, change, date) =>
      Promise.resolve(savedFrom(change, date)),
    );
    getCapacityConfig = jest.fn(() =>
      Promise.resolve({
        dailyCapacity: 15,
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      }),
    );
    countActiveAppointmentsOnDate = jest.fn(() => Promise.resolve(0));
    countAppointmentLoans = jest.fn(() =>
      Promise.resolve({ totalLoans: 0, openLoans: 0 }),
    );

    const repository: IRequestRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAppointmentById,
      saveStatusChange: jest.fn(),
      saveAppointment: jest.fn(),
      rescheduleAppointment,
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
      findNotificationContext: jest.fn(() => Promise.resolve(CONTEXT)),
      findSchedulingConflicts,
      findMissingMaterialIds: jest.fn(),
      countActiveAppointmentsOnDate,
      countActiveAppointmentsByDateRange: jest.fn(),
      findMostRequestedMaterials: jest.fn(),
      countAppointmentLoans,
      countScheduledAppointmentLoansByRequest: jest.fn(),
    };
    const roomCapacity: IRoomCapacityRepository = {
      getConfig: getCapacityConfig,
      saveDailyCapacity: jest.fn(),
    };
    useCase = new RescheduleAppointmentUseCase(
      repository,
      queries,
      roomCapacity,
    );
  });

  it('reschedules a PROGRAMADA appointment to a new day, records the history change and queues an email', async () => {
    const result = await useCase.execute({
      appointmentId: 'appointment-1',
      date: '2026-11-24',
      userId: 'staff-1',
    });

    expect(findSchedulingConflicts).toHaveBeenCalledWith(
      'request-1',
      new Date('2026-11-24T00:00:00.000Z'),
    );
    expect(rescheduleAppointment).toHaveBeenCalledTimes(1);
    const [appointmentId, change, date, email] =
      rescheduleAppointment.mock.calls[0];
    expect(appointmentId).toBe('appointment-1');
    expect(change).toMatchObject({
      requestId: 'request-1',
      previousStatus: 'AGENDADA',
      newStatus: 'AGENDADA',
      changedBy: 'staff-1',
      comment: 'Cita reprogramada del 2026-11-20 al 2026-11-24',
    });
    expect(date).toEqual(new Date('2026-11-24T00:00:00.000Z'));
    expect(email?.text).toContain(
      'Fecha de la cita: martes, 24 de noviembre de 2026',
    );
    expect(result).toMatchObject({
      id: 'request-1',
      status: 'AGENDADA',
      appointment: {
        id: 'appointment-1',
        date: '2026-11-24',
        status: 'PROGRAMADA',
      },
      statusChange: {
        previousStatus: 'AGENDADA',
        newStatus: 'AGENDADA',
        comment: 'Cita reprogramada del 2026-11-20 al 2026-11-24',
      },
    });
  });

  it('uses the custom comment when provided', async () => {
    await useCase.execute({
      appointmentId: 'appointment-1',
      date: '2026-11-24',
      comment: '  El solicitante pidió cambiar para el martes  ',
      userId: 'staff-1',
    });

    expect(rescheduleAppointment.mock.calls[0][1].comment).toBe(
      'El solicitante pidió cambiar para el martes',
    );
  });

  it('re-validates availability and rejects a material already booked on the new day', async () => {
    findSchedulingConflicts.mockResolvedValue({
      ...SCHEDULABLE,
      bookedMaterials: [
        {
          materialId: 'material-1',
          catalogCode: 'AHB-001',
          title: 'Actas de 1890',
          date: new Date('2026-11-24T00:00:00.000Z'),
          trackingCode: 'SOL-2026-00099',
        },
      ],
    });

    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        date: '2026-11-24',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(MaterialAlreadyBookedError);
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });

  it('re-validates material status and rejects EN_RESTAURACION or NO_CONSULTABLE', async () => {
    findSchedulingConflicts.mockResolvedValue({
      ...SCHEDULABLE,
      materials: [
        {
          id: 'material-1',
          catalogCode: 'AHB-001',
          title: 'Actas de 1890',
          status: 'EN_RESTAURACION',
        },
      ],
    });

    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        date: '2026-11-24',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(MaterialNotAvailableError);
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });

  it('re-validates daily room capacity on the new day', async () => {
    countActiveAppointmentsOnDate.mockResolvedValue(15);

    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        date: '2026-11-24',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(RoomCapacityExceededError);
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });

  it('rejects rescheduling to the same day or a Sunday', async () => {
    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        date: '2026-11-20',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(InvalidAppointmentDateError);

    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        date: '2026-11-22',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(InvalidAppointmentDateError);
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });

  it('throws AppointmentNotFoundError when the appointment does not exist', async () => {
    findAppointmentById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        appointmentId: 'missing',
        date: '2026-11-24',
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
          date: '2026-11-24',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(AppointmentNotScheduledError);
      expect(rescheduleAppointment).not.toHaveBeenCalled();
    },
  );

  it('rejects when the request is no longer AGENDADA', async () => {
    findAppointmentById.mockResolvedValue(
      storedAppointment('PROGRAMADA', 'DISPONIBLE'),
    );

    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        date: '2026-11-24',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(InvalidStatusTransitionError);
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });

  it.each<AppointmentLoanCounts>([
    { totalLoans: 1, openLoans: 0 },
    { totalLoans: 2, openLoans: 1 },
  ])(
    'rejects rescheduling an appointment that already has material loans (%o) and does not call the repository (HU-72, RN-20)',
    async (loanCounts) => {
      countAppointmentLoans.mockResolvedValue(loanCounts);

      await expect(
        useCase.execute({
          appointmentId: 'appointment-1',
          date: '2026-11-24',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(AppointmentHasLoansError);
      expect(countAppointmentLoans).toHaveBeenCalledWith('appointment-1');
      expect(rescheduleAppointment).not.toHaveBeenCalled();
    },
  );
});
