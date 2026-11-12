import type {
  RequestListCriteria,
  RequestListItem,
  RequestRepository,
} from '../ports/request.repository.port';
import { ListRequestsUseCase } from './list-requests.use-case';

const buildItem = (): RequestListItem => ({
  id: 'request-1',
  trackingCode: 'SOL-2026-00001',
  status: 'RECIBIDA',
  deliveryMode: 'PRESENCIAL',
  desiredDate: new Date('2026-12-01T00:00:00.000Z'),
  registeredAt: new Date('2026-11-10T15:00:00.000Z'),
  rejectionReason: null,
  requester: {
    firstName: 'Juan',
    middleName: 'Carlos',
    lastName: 'Pérez',
    secondLastName: null,
    email: 'juan@mail.com',
  },
  materials: [
    {
      id: 'material-1',
      catalogCode: 'TH-DOC-0001',
      title: 'Acta de fundación de la villa',
    },
  ],
});

describe('ListRequestsUseCase', () => {
  let list: jest.Mock<
    ReturnType<RequestRepository['list']>,
    [RequestListCriteria]
  >;
  let useCase: ListRequestsUseCase;

  beforeEach(() => {
    list = jest.fn<
      ReturnType<RequestRepository['list']>,
      [RequestListCriteria]
    >(() => Promise.resolve({ items: [buildItem()], total: 31 }));
    useCase = new ListRequestsUseCase({
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn(),
      list,
      listAppointments: jest.fn(),
      findById: jest.fn(),
      listByRequesterUser: jest.fn(),
      findEntityById: jest.fn(),
      findNotificationContext: jest.fn(),
      saveStatusChange: jest.fn(),
      saveAppointment: jest.fn(),
      findSchedulingConflicts: jest.fn(),
    });
  });

  it('shows the newest requests first and the first page by default', async () => {
    await useCase.execute({});

    expect(list).toHaveBeenCalledWith({
      status: undefined,
      desiredFrom: undefined,
      desiredTo: undefined,
      requester: undefined,
      material: undefined,
      sort: 'registeredAt',
      order: 'desc',
      page: 1,
      limit: 20,
    });
  });

  it('passes the filters, the order and the page to the repository', async () => {
    await useCase.execute({
      status: 'AGENDADA',
      desiredFrom: '2026-12-01',
      desiredTo: '2026-12-31',
      requester: 'juan',
      material: 'cabildo',
      sort: 'desiredDate',
      order: 'asc',
      page: 3,
      limit: 10,
    });

    expect(list).toHaveBeenCalledWith({
      status: 'AGENDADA',
      desiredFrom: '2026-12-01',
      desiredTo: '2026-12-31',
      requester: 'juan',
      material: 'cabildo',
      sort: 'desiredDate',
      order: 'asc',
      page: 3,
      limit: 10,
    });
  });

  it('returns the page with the requester name, dates as text and the total', async () => {
    const result = await useCase.execute({ page: 2, limit: 10 });

    expect(result).toEqual({
      items: [
        {
          id: 'request-1',
          trackingCode: 'SOL-2026-00001',
          status: 'RECIBIDA',
          deliveryMode: 'PRESENCIAL',
          desiredDate: '2026-12-01',
          registeredAt: '2026-11-10T15:00:00.000Z',
          requesterName: 'Juan Carlos Pérez',
          requesterEmail: 'juan@mail.com',
          materials: [
            {
              id: 'material-1',
              catalogCode: 'TH-DOC-0001',
              title: 'Acta de fundación de la villa',
            },
          ],
        },
      ],
      page: 2,
      limit: 10,
      total: 31,
    });
  });
});
