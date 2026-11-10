import type { NotificationDraft } from '../../../notifications/domain/notification-draft';
import type { DeliveryMode } from '../../domain/delivery-mode';
import { Request } from '../../domain/entities/request.entity';
import { InvalidAppointmentDateError } from '../../domain/errors/invalid-appointment-date.error';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition.error';
import { MaterialUnavailableError } from '../../domain/errors/material-unavailable.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import type { MaterialAvailability } from '../../domain/material-availability';
import type { RequestStatus } from '../../domain/request-status';
import type { StatusChange } from '../../domain/status-change';
import type {
  RequestNotificationContext,
  RequestRepository,
  SavedAppointment,
} from '../ports/request.repository.port';
import { ScheduleAppointmentUseCase } from './schedule-appointment.use-case';

const buildRequest = (
  status: RequestStatus,
  deliveryMode: DeliveryMode = 'PRESENCIAL',
): Request => new Request({ id: 'request-1', status, deliveryMode });

const MATERIALS = [
  { id: 'material-1', catalogCode: 'AHB-001', title: 'Actas de 1890' },
  { id: 'material-2', catalogCode: 'AHB-002', title: 'El Heraldo, 1935' },
];

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
  let findEntityById: jest.Mock<Promise<Request | null>, [string]>;
  let findMaterialAvailability: jest.Mock<
    Promise<MaterialAvailability[]>,
    [string, Date]
  >;
  let saveAppointment: jest.Mock<
    Promise<SavedAppointment>,
    [StatusChange, Date, NotificationDraft | null]
  >;
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
    findEntityById = jest.fn<Promise<Request | null>, [string]>(() =>
      Promise.resolve(buildRequest('DISPONIBLE')),
    );
    findMaterialAvailability = jest.fn<
      Promise<MaterialAvailability[]>,
      [string, Date]
    >(() =>
      Promise.resolve([
        {
          catalogCode: 'AHB-001',
          title: 'Actas de 1890',
          status: 'DISPONIBLE',
          bookedBy: null,
        },
        {
          catalogCode: 'AHB-002',
          title: 'El Heraldo, 1935',
          status: 'DISPONIBLE',
          bookedBy: null,
        },
      ]),
    );
    saveAppointment = jest.fn<
      Promise<SavedAppointment>,
      [StatusChange, Date, NotificationDraft | null]
    >((change, date) => Promise.resolve(savedFrom(change, date)));
    const repository: RequestRepository = {
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn(),
      list: jest.fn(),
      listAppointments: jest.fn(),
      findById: jest.fn(),
      listByRequesterUser: jest.fn(),
      findEntityById,
      findMaterialAvailability,
      findNotificationContext: jest.fn(() => Promise.resolve(CONTEXT)),
      saveStatusChange: jest.fn(),
      saveAppointment,
    };
    useCase = new ScheduleAppointmentUseCase(repository);
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
    findEntityById.mockResolvedValue(buildRequest(status));

    await expect(schedule()).rejects.toThrow(InvalidStatusTransitionError);
    expect(saveAppointment).not.toHaveBeenCalled();
  });

  it('rejects a request with a digital delivery', async () => {
    findEntityById.mockResolvedValue(buildRequest('DISPONIBLE', 'DIGITAL'));

    await expect(schedule()).rejects.toThrow(InvalidStatusTransitionError);
    expect(saveAppointment).not.toHaveBeenCalled();
  });

  it('throws RequestNotFoundError when the request does not exist', async () => {
    findEntityById.mockResolvedValue(null);

    await expect(schedule()).rejects.toThrow(RequestNotFoundError);
  });

  it('lets the conflict of the repository through', async () => {
    saveAppointment.mockRejectedValue(new RequestStatusConflictError());

    await expect(schedule()).rejects.toThrow(RequestStatusConflictError);
  });

  describe('material availability (HU-20)', () => {
    it('rejects a double booking on the same day with the conflicting material and request, and saves nothing', async () => {
      findMaterialAvailability.mockResolvedValue([
        {
          catalogCode: 'AHB-001',
          title: 'Actas de 1890',
          status: 'DISPONIBLE',
          bookedBy: 'SOL-2026-00012',
        },
        {
          catalogCode: 'AHB-002',
          title: 'El Heraldo, 1935',
          status: 'DISPONIBLE',
          bookedBy: null,
        },
      ]);

      await expect(schedule('2026-11-20')).rejects.toThrow(
        new RegExp(
          'No se puede agendar la cita del viernes 20/11/2026: ' +
            'AHB-001 · Actas de 1890 ya tiene una cita ese día \\(solicitud SOL-2026-00012\\)\\.',
        ),
      );
      expect(findMaterialAvailability).toHaveBeenCalledWith(
        'request-1',
        new Date('2026-11-20T00:00:00.000Z'),
      );
      expect(saveAppointment).not.toHaveBeenCalled();
    });

    it.each([
      ['EN_RESTAURACION', 'está en restauración'],
      ['NO_CONSULTABLE', 'no es consultable'],
    ] as const)(
      'rejects a material in %s with a clear reason and saves nothing',
      async (status, reasonText) => {
        findMaterialAvailability.mockResolvedValue([
          {
            catalogCode: 'AHB-002',
            title: 'El Heraldo, 1935',
            status,
            bookedBy: null,
          },
        ]);

        await expect(schedule('2026-11-20')).rejects.toThrow(
          `No se puede agendar la cita del viernes 20/11/2026: AHB-002 · El Heraldo, 1935 ${reasonText}.`,
        );
        expect(saveAppointment).not.toHaveBeenCalled();
      },
    );

    it('lets a material EN_USO be scheduled: it only applies to its day in the room (HU-72)', async () => {
      findMaterialAvailability.mockResolvedValue([
        {
          catalogCode: 'AHB-001',
          title: 'Actas de 1890',
          status: 'EN_USO',
          bookedBy: null,
        },
      ]);

      await expect(schedule('2026-11-20')).resolves.toMatchObject({
        status: 'AGENDADA',
      });
      expect(saveAppointment).toHaveBeenCalledTimes(1);
    });

    it('lists every conflict in one message when more than one material fails', async () => {
      findMaterialAvailability.mockResolvedValue([
        {
          catalogCode: 'AHB-001',
          title: 'Actas de 1890',
          status: 'DISPONIBLE',
          bookedBy: 'SOL-2026-00012',
        },
        {
          catalogCode: 'AHB-002',
          title: 'El Heraldo, 1935',
          status: 'EN_RESTAURACION',
          bookedBy: null,
        },
      ]);

      await expect(schedule('2026-11-20')).rejects.toThrow(
        'No se puede agendar la cita del viernes 20/11/2026: ' +
          'AHB-001 · Actas de 1890 ya tiene una cita ese día (solicitud SOL-2026-00012); ' +
          'AHB-002 · El Heraldo, 1935 está en restauración.',
      );
      expect(saveAppointment).not.toHaveBeenCalled();
    });

    it('lets the concurrent booking error of the repository through (D-09)', async () => {
      saveAppointment.mockRejectedValue(
        MaterialUnavailableError.concurrentBooking(),
      );

      await expect(schedule()).rejects.toThrow(MaterialUnavailableError);
    });
  });
});
