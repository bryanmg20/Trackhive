import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import type { DeliveryMode } from '../../domain/enums/delivery-mode';
import { Request } from '../../domain/entities/request.entity';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { MaterialNotAvailableError } from '../../domain/errors/material-not-available.error';
import { InvalidAppointmentDateError } from '../../domain/errors/invalid-appointment-date.error';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import { RoomCapacityExceededError } from '../../domain/errors/room-capacity-exceeded.error';
import type { RequestStatus } from '../../domain/enums/request-status';
import type { StatusChange } from '../../domain/value-objects/status-change';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import type { RoomCapacityConfig } from '../../domain/value-objects/room-capacity';
import type { SavedAppointment } from '../../domain/value-objects/saved-appointment';
import type {
  RequestNotificationContext,
  SchedulingConflicts,
  IRequestQueryService,
} from '../ports/request-query.port';
import { ScheduleAppointmentUseCase } from './schedule-appointment.use-case';

const buildRequest = (
  status: RequestStatus,
  deliveryMode: DeliveryMode = 'PRESENCIAL',
): Request => new Request({ id: 'request-1', status, deliveryMode });

const MATERIALS = [
  { id: 'material-1', catalogCode: 'AHB-001', title: 'Actas de 1890' },
  { id: 'material-2', catalogCode: 'AHB-002', title: 'El Heraldo, 1935' },
];

// What findSchedulingConflicts answers when nothing blocks the scheduling
const SCHEDULABLE: SchedulingConflicts = {
  materials: MATERIALS.map((material) => ({
    ...material,
    status: 'DISPONIBLE',
  })),
  bookedMaterials: [],
};

// Echoes what it receives, like the database would
const savedFrom = (change: StatusChange, date: Date): SavedAppointment => ({
  id: 'appointment-1',
  date,
  status: 'PROGRAMADA',
  requester: {
    id: 'requester-1',
    firstName: 'Juan',
    middleName: null,
    lastName: 'Pérez',
    secondLastName: 'Gómez',
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
      middleName: 'María',
      lastName: 'Gómez',
      secondLastName: null,
    },
  },
});

describe('ScheduleAppointmentUseCase', () => {
  let findById: jest.Mock<Promise<Request | null>, [string]>;
  let findSchedulingConflicts: jest.Mock<
    Promise<SchedulingConflicts>,
    [string, Date]
  >;
  let saveAppointment: jest.Mock<
    Promise<SavedAppointment>,
    [StatusChange, Date, NotificationDraft | null]
  >;
  let getCapacityConfig: jest.Mock<Promise<RoomCapacityConfig>, []>;
  let countActiveAppointmentsOnDate: jest.Mock<Promise<number>, [Date]>;
  let useCase: ScheduleAppointmentUseCase;

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
    findById = jest.fn<Promise<Request | null>, [string]>(() =>
      Promise.resolve(buildRequest('DISPONIBLE')),
    );
    findSchedulingConflicts = jest.fn<
      Promise<SchedulingConflicts>,
      [string, Date]
    >(() => Promise.resolve(SCHEDULABLE));
    saveAppointment = jest.fn<
      Promise<SavedAppointment>,
      [StatusChange, Date, NotificationDraft | null]
    >((change, date) => Promise.resolve(savedFrom(change, date)));
    getCapacityConfig = jest.fn<Promise<RoomCapacityConfig>, []>(() =>
      Promise.resolve({
        dailyCapacity: 15,
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      }),
    );
    countActiveAppointmentsOnDate = jest.fn<Promise<number>, [Date]>(() =>
      Promise.resolve(0),
    );
    const repository: IRequestRepository = {
      save: jest.fn(),
      findById,
      findAppointmentById: jest.fn(),
      saveStatusChange: jest.fn(),
      saveAppointment,
      rescheduleAppointment: jest.fn(),
      cancelAppointment: jest.fn(),
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
    };
    const roomCapacity: IRoomCapacityRepository = {
      getConfig: getCapacityConfig,
      saveDailyCapacity: jest.fn(),
    };
    useCase = new ScheduleAppointmentUseCase(repository, queries, roomCapacity);
  });

  const schedule = (date = '2026-11-20') =>
    useCase.execute({ requestId: 'request-1', date, userId: 'staff-1' });

  describe('emailing the requester (HU-23)', () => {
    const queuedEmail = () => saveAppointment.mock.calls[0][2];

    it('queues the email with AGENDADA, the day, the service hours and the material', async () => {
      await schedule();

      expect(queuedEmail()).toMatchObject({
        recipientEmail: 'juan@example.com',
        template: 'CAMBIO_ESTADO',
        subject: 'Su solicitud SOL-2026-00042 pasó a «Agendada»',
      });
      const text = queuedEmail()?.text ?? '';
      expect(text).toContain('Nuevo estado: Agendada');
      expect(text).toContain(
        'Fecha de la cita: viernes, 20 de noviembre de 2026',
      );
      expect(text).toContain('Horario de atención: de 8:00 a 17:00');
      expect(text).toContain('AHB-001 · Actas de 1890');
      expect(text).toContain('AHB-002 · El Heraldo, 1935');
    });

    it('gives the Saturday service hours in the email of a Saturday', async () => {
      await schedule('2026-11-21');

      expect(queuedEmail()?.text).toContain(
        'Fecha de la cita: sábado, 21 de noviembre de 2026',
      );
      expect(queuedEmail()?.text).toContain('de 9:00 a 13:00');
    });

    it('queues nothing when the day is a Sunday', async () => {
      await expect(schedule('2026-11-22')).rejects.toThrow(
        InvalidAppointmentDateError,
      );
      expect(saveAppointment).not.toHaveBeenCalled();
    });
  });

  describe('availability of the material (HU-20)', () => {
    it('rejects a material that already has a cita that day and saves nothing', async () => {
      findSchedulingConflicts.mockResolvedValue({
        ...SCHEDULABLE,
        bookedMaterials: [
          {
            materialId: 'material-1',
            catalogCode: 'AHB-001',
            title: 'Actas de 1890',
            date: new Date('2026-11-20T00:00:00.000Z'),
            trackingCode: 'SOL-2026-00042',
          },
        ],
      });

      await expect(schedule()).rejects.toThrow(MaterialAlreadyBookedError);
      await expect(schedule()).rejects.toThrow(
        'El material «Actas de 1890» (AHB-001) ya tiene cita el viernes, ' +
          '20 de noviembre de 2026 (solicitud SOL-2026-00042).',
      );
      expect(saveAppointment).not.toHaveBeenCalled();
    });

    it.each<[string, string]>([
      ['EN_RESTAURACION', 'está en restauración'],
      ['NO_CONSULTABLE', 'no es consultable'],
    ])(
      'rejects a material that is %s and saves nothing',
      async (status, phrase) => {
        findSchedulingConflicts.mockResolvedValue({
          ...SCHEDULABLE,
          materials: [
            {
              id: 'material-1',
              catalogCode: 'AHB-001',
              title: 'Actas de 1890',
              status,
            },
          ],
        });

        await expect(schedule()).rejects.toThrow(MaterialNotAvailableError);
        await expect(schedule()).rejects.toThrow(
          `El material «Actas de 1890» (AHB-001) ${phrase} y no se puede agendar.`,
        );
        expect(saveAppointment).not.toHaveBeenCalled();
      },
    );

    it('schedules a material that is EN_USO: it only applies to the day in the room (HU-72)', async () => {
      findSchedulingConflicts.mockResolvedValue({
        ...SCHEDULABLE,
        materials: MATERIALS.map((material) => ({
          ...material,
          status: 'EN_USO',
        })),
      });

      await schedule();

      expect(saveAppointment).toHaveBeenCalledTimes(1);
    });
  });

  it('saves the change to AGENDADA with who scheduled it and the day', async () => {
    await schedule();

    expect(saveAppointment).toHaveBeenCalledTimes(1);
    const [change, date] = saveAppointment.mock.calls[0];
    expect(change).toMatchObject({
      requestId: 'request-1',
      previousStatus: 'DISPONIBLE',
      newStatus: 'AGENDADA',
      changedBy: 'staff-1',
      comment: null,
    });
    expect(date).toEqual(new Date('2026-11-20T00:00:00.000Z'));
  });

  it('returns the day, its service hours, the requester and every material', async () => {
    const result = await schedule();

    expect(result).toEqual({
      id: 'request-1',
      status: 'AGENDADA',
      allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
      appointment: {
        id: 'appointment-1',
        date: '2026-11-20',
        serviceHours: { opensAt: '08:00', closesAt: '17:00' },
        status: 'PROGRAMADA',
        requester: { id: 'requester-1', name: 'Juan Pérez Gómez' },
        materials: MATERIALS,
      },
      statusChange: {
        previousStatus: 'DISPONIBLE',
        newStatus: 'AGENDADA',
        changedAt: expect.any(String) as string,
        changedBy: { id: 'staff-1', name: 'Ana María Gómez' },
        comment: null,
      },
    });
  });

  it('gives the Saturday service hours to a Saturday appointment', async () => {
    const result = await schedule('2026-11-21');

    expect(result.appointment.serviceHours).toEqual({
      opensAt: '09:00',
      closesAt: '13:00',
    });
  });

  it('rejects a Sunday and saves nothing', async () => {
    await expect(schedule('2026-11-22')).rejects.toThrow(
      InvalidAppointmentDateError,
    );
    expect(saveAppointment).not.toHaveBeenCalled();
  });

  it.each<RequestStatus>([
    'RECIBIDA',
    'EN_BUSQUEDA',
    'AGENDADA',
    'ATENDIDA',
    'CERRADA',
    'RECHAZADA',
  ])('rejects a request in %s and saves nothing', async (status) => {
    findById.mockResolvedValue(buildRequest(status));

    await expect(schedule()).rejects.toThrow(InvalidStatusTransitionError);
    expect(saveAppointment).not.toHaveBeenCalled();
  });

  it('rejects a request with a digital delivery', async () => {
    findById.mockResolvedValue(buildRequest('DISPONIBLE', 'DIGITAL'));

    await expect(schedule()).rejects.toThrow(InvalidStatusTransitionError);
    expect(saveAppointment).not.toHaveBeenCalled();
  });

  it('throws RequestNotFoundError when the request does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(schedule()).rejects.toThrow(RequestNotFoundError);
  });

  it('lets the conflict of the repository through', async () => {
    saveAppointment.mockRejectedValue(new RequestStatusConflictError());

    await expect(schedule()).rejects.toThrow(RequestStatusConflictError);
  });

  describe('daily reading room capacity (HU-20.1)', () => {
    it('allows scheduling the 15th appointment under the default capacity', async () => {
      countActiveAppointmentsOnDate.mockResolvedValue(14);

      const result = await schedule('2026-11-20');

      expect(result.status).toBe('AGENDADA');
      expect(saveAppointment).toHaveBeenCalledTimes(1);
    });

    it('rejects the 16th appointment when default capacity (15) is reached', async () => {
      countActiveAppointmentsOnDate.mockResolvedValue(15);

      await expect(schedule('2026-11-20')).rejects.toThrow(
        RoomCapacityExceededError,
      );
      expect(saveAppointment).not.toHaveBeenCalled();
    });

    it('rejects when occupied appointments meet or exceed a lowered capacity', async () => {
      getCapacityConfig.mockResolvedValue({
        dailyCapacity: 3,
        isDefault: false,
        updatedAt: new Date('2026-11-18T00:00:00Z'),
        updatedBy: null,
      });
      countActiveAppointmentsOnDate.mockResolvedValue(5);

      await expect(schedule('2026-11-20')).rejects.toThrow(
        'La sala de consulta alcanzó su capacidad máxima de 3 citas',
      );
      expect(saveAppointment).not.toHaveBeenCalled();
    });
  });
});
