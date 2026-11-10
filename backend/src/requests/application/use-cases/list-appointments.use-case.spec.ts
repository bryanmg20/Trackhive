import type {
  AppointmentListCriteria,
  AppointmentListItem,
  RequestRepository,
} from '../ports/request.repository.port';
import { ListAppointmentsUseCase } from './list-appointments.use-case';

const buildItem = (
  overrides: Partial<AppointmentListItem> = {},
): AppointmentListItem => ({
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
    middleName: 'Carlos',
    lastName: 'Pérez',
    secondLastName: null,
    email: 'juan@mail.com',
    phone: '3001234567',
    requesterType: 'INVESTIGADOR',
    institution: 'Universidad del Norte',
    documentType: 'CC',
    documentNumber: '123456789',
  },
  scheduledBy: {
    id: 'staff-1',
    firstName: 'Ana',
    middleName: 'María',
    lastName: 'Gómez',
    secondLastName: null,
  },
  materials: [
    {
      id: 'material-1',
      catalogCode: 'TH-DOC-0001',
      title: 'Acta de fundación de la villa',
      materialType: 'DOCUMENTO',
      depot: 'D-01',
      shelf: 'E-01',
      box: 'C-001',
    },
  ],
  ...overrides,
});

describe('ListAppointmentsUseCase', () => {
  let listAppointments: jest.Mock<
    ReturnType<RequestRepository['listAppointments']>,
    [AppointmentListCriteria]
  >;
  let useCase: ListAppointmentsUseCase;

  beforeEach(() => {
    listAppointments = jest.fn<
      ReturnType<RequestRepository['listAppointments']>,
      [AppointmentListCriteria]
    >(() => Promise.resolve({ items: [buildItem()], total: 8 }));
    useCase = new ListAppointmentsUseCase({
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn(),
      list: jest.fn(),
      listAppointments,
      findById: jest.fn(),
      listByRequesterUser: jest.fn(),
      findEntityById: jest.fn(),
      findMaterialAvailability: jest.fn(),
      findNotificationContext: jest.fn(),
      saveStatusChange: jest.fn(),
      saveAppointment: jest.fn(),
    });
  });

  it('orders appointments chronologically on the first page by default', async () => {
    await useCase.execute({});

    expect(listAppointments).toHaveBeenCalledWith({
      status: undefined,
      from: undefined,
      to: undefined,
      requester: undefined,
      material: undefined,
      sort: 'appointmentDate',
      order: 'asc',
      page: 1,
      limit: 20,
    });
  });

  it('passes the filters, the order and the page to the repository', async () => {
    await useCase.execute({
      status: 'PROGRAMADA',
      from: '2026-11-01',
      to: '2026-11-30',
      requester: 'juan',
      material: 'cabildo',
      sort: 'createdAt',
      order: 'desc',
      page: 2,
      limit: 10,
    });

    expect(listAppointments).toHaveBeenCalledWith({
      status: 'PROGRAMADA',
      from: '2026-11-01',
      to: '2026-11-30',
      requester: 'juan',
      material: 'cabildo',
      sort: 'createdAt',
      order: 'desc',
      page: 2,
      limit: 10,
    });
  });

  it('returns the page with formatted names, service hours, location and total', async () => {
    const result = await useCase.execute({ page: 1, limit: 10 });

    expect(result).toEqual({
      items: [
        {
          id: 'appointment-1',
          date: '2026-11-20',
          serviceHours: { opensAt: '08:00', closesAt: '17:00' },
          status: 'PROGRAMADA',
          notes: null,
          createdAt: '2026-11-10T15:00:00.000Z',
          request: {
            id: 'request-1',
            trackingCode: 'SOL-2026-00001',
            status: 'AGENDADA',
            deliveryMode: 'PRESENCIAL',
          },
          requester: {
            id: 'requester-1',
            name: 'Juan Carlos Pérez',
            email: 'juan@mail.com',
            phone: '3001234567',
            requesterType: 'INVESTIGADOR',
            institution: 'Universidad del Norte',
            documentType: 'CC',
            documentNumber: '123456789',
          },
          scheduledBy: {
            id: 'staff-1',
            name: 'Ana María Gómez',
          },
          materials: [
            {
              id: 'material-1',
              catalogCode: 'TH-DOC-0001',
              title: 'Acta de fundación de la villa',
              materialType: 'DOCUMENTO',
              location: { depot: 'D-01', shelf: 'E-01', box: 'C-001' },
            },
          ],
        },
      ],
      page: 1,
      limit: 10,
      total: 8,
    });
  });

  it('computes the Saturday service hours for a Saturday appointment', async () => {
    listAppointments.mockResolvedValue({
      items: [
        buildItem({
          appointmentDate: new Date('2026-11-21T00:00:00.000Z'),
        }),
      ],
      total: 1,
    });

    const result = await useCase.execute({});

    expect(result.items[0].serviceHours).toEqual({
      opensAt: '09:00',
      closesAt: '13:00',
    });
  });
});
