import { MaterialLoan } from '../../../materials/domain/entities/material-loan.entity';
import type {
  IMaterialLoanRepository,
  MaterialLoanRecord,
} from '../../../materials/domain/repositories/material-loan.repository';
import { Request } from '../../domain/entities/request.entity';
import { AppointmentMaterialNotFoundError } from '../../domain/errors/appointment-material-not-found.error';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error';
import { AppointmentNotScheduledError } from '../../domain/errors/appointment-not-scheduled.error';
import { AppointmentNotTodayError } from '../../domain/errors/appointment-not-today.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import { todayInBogota } from '../../domain/value-objects/desired-date';
import type { StoredAppointment } from '../../domain/value-objects/saved-appointment';
import { DeliverMaterialUseCase } from './deliver-material.use-case';

const TODAY = todayInBogota();
const TOMORROW = new Date(TODAY.getTime() + 24 * 60 * 60 * 1000);

const buildStoredAppointment = (
  overrides: Partial<StoredAppointment> = {},
): StoredAppointment => ({
  id: 'appointment-1',
  date: TODAY,
  status: 'PROGRAMADA',
  materialIds: ['material-1', 'material-2'],
  request: new Request({
    id: 'request-1',
    status: 'AGENDADA',
    deliveryMode: 'PRESENCIAL',
  }),
  ...overrides,
});

const DELIVERED_RECORD: MaterialLoanRecord = {
  id: 'loan-1',
  materialId: 'material-1',
  materialCatalogCode: 'TH-DOC-0001',
  materialTitle: 'Acta del Cabildo de 1810',
  materialStatus: 'EN_USO',
  appointment: {
    id: 'appointment-1',
    date: TODAY,
    requestId: 'request-1',
    trackingCode: 'SOL-2026-00001',
  },
  requester: { id: 'requester-1', name: 'Juan Pérez' },
  handedOverAt: new Date('2026-11-19T14:30:00Z'),
  handedOverBy: { id: 'staff-1', name: 'Ana Gómez' },
  deliveryNotes: 'Entregado en sala',
  returnedAt: null,
  returnedBy: null,
  returnNotes: null,
};

describe('DeliverMaterialUseCase', () => {
  let findAppointmentById: jest.Mock<
    Promise<StoredAppointment | null>,
    [string]
  >;
  let deliverMaterial: jest.Mock<Promise<MaterialLoanRecord>, [MaterialLoan]>;
  let useCase: DeliverMaterialUseCase;

  beforeEach(() => {
    findAppointmentById = jest.fn<Promise<StoredAppointment | null>, [string]>(
      () => Promise.resolve(buildStoredAppointment()),
    );
    deliverMaterial = jest.fn<Promise<MaterialLoanRecord>, [MaterialLoan]>(() =>
      Promise.resolve(DELIVERED_RECORD),
    );

    const requestRepo: IRequestRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAppointmentById,
      saveStatusChange: jest.fn(),
      saveAppointment: jest.fn(),
      rescheduleAppointment: jest.fn(),
      cancelAppointment: jest.fn(),
    };
    const loanRepo: IMaterialLoanRepository = {
      deliverMaterial,
      returnActiveLoan: jest.fn(),
      findMaterialHistory: jest.fn(),
    };
    useCase = new DeliverMaterialUseCase(requestRepo, loanRepo);
  });

  it('delivers the material for today PROGRAMADA appointment and returns the DTO', async () => {
    const result = await useCase.execute({
      appointmentId: 'appointment-1',
      materialId: 'material-1',
      userId: 'staff-1',
      notes: 'Entregado en sala',
    });

    expect(deliverMaterial).toHaveBeenCalledTimes(1);
    const loan = deliverMaterial.mock.calls[0][0];
    expect(loan).toBeInstanceOf(MaterialLoan);
    expect(loan.materialId).toBe('material-1');
    expect(loan.appointmentId).toBe('appointment-1');
    expect(loan.handedOverById).toBe('staff-1');
    expect(loan.deliveryNotes).toBe('Entregado en sala');
    expect(result.materialStatus).toBe('EN_USO');
    expect(result.handedOverBy.name).toBe('Ana Gómez');
    expect(result.returnedAt).toBeNull();
  });

  it('throws AppointmentNotFoundError when the appointment does not exist', async () => {
    findAppointmentById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        appointmentId: 'missing',
        materialId: 'material-1',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
    expect(deliverMaterial).not.toHaveBeenCalled();
  });

  it('throws AppointmentNotScheduledError when the appointment is not PROGRAMADA', async () => {
    findAppointmentById.mockResolvedValue(
      buildStoredAppointment({ status: 'CUMPLIDA' }),
    );

    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        materialId: 'material-1',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(AppointmentNotScheduledError);
    expect(deliverMaterial).not.toHaveBeenCalled();
  });

  it('throws AppointmentNotTodayError when the appointment is not scheduled for today', async () => {
    findAppointmentById.mockResolvedValue(
      buildStoredAppointment({ date: TOMORROW }),
    );

    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        materialId: 'material-1',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(AppointmentNotTodayError);
    expect(deliverMaterial).not.toHaveBeenCalled();
  });

  it('throws AppointmentMaterialNotFoundError when the material is not in the appointment', async () => {
    await expect(
      useCase.execute({
        appointmentId: 'appointment-1',
        materialId: 'other-material',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(AppointmentMaterialNotFoundError);
    expect(deliverMaterial).not.toHaveBeenCalled();
  });
});
