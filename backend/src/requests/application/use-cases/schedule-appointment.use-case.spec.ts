import type { DeliveryMode } from '../../domain/delivery-mode';
import { Request } from '../../domain/entities/request.entity';
import { InvalidAppointmentDateError } from '../../domain/errors/invalid-appointment-date.error';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import type { RequestStatus } from '../../domain/request-status';
import type { StatusChange } from '../../domain/status-change';
import type {
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
  let saveAppointment: jest.Mock<
    Promise<SavedAppointment>,
    [StatusChange, Date]
  >;
  let useCase: ScheduleAppointmentUseCase;

  beforeEach(() => {
    findEntityById = jest.fn<Promise<Request | null>, [string]>(() =>
      Promise.resolve(buildRequest('DISPONIBLE')),
    );
    saveAppointment = jest.fn<Promise<SavedAppointment>, [StatusChange, Date]>(
      (change, date) => Promise.resolve(savedFrom(change, date)),
    );
    const repository: RequestRepository = {
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      listByRequesterUser: jest.fn(),
      findEntityById,
      saveStatusChange: jest.fn(),
      saveAppointment,
    };
    useCase = new ScheduleAppointmentUseCase(repository);
  });

  const schedule = (date = '2026-11-20') =>
    useCase.execute({ requestId: 'request-1', date, userId: 'staff-1' });

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
});
