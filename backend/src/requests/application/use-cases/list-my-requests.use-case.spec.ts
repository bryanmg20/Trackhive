import type {
  MyRequestListCriteria,
  RequestListItem,
  RequestRepository,
} from '../ports/request.repository.port';
import { ListMyRequestsUseCase } from './list-my-requests.use-case';

const buildItem = (): RequestListItem => ({
  id: 'request-1',
  trackingCode: 'SOL-2026-00001',
  status: 'EN_BUSQUEDA',
  deliveryMode: 'DIGITAL',
  desiredDate: new Date('2026-12-01T00:00:00.000Z'),
  registeredAt: new Date('2026-11-10T15:00:00.000Z'),
  rejectionReason: null,
  requester: {
    firstName: 'Ana',
    middleName: null,
    lastName: 'Pérez',
    secondLastName: null,
    email: 'ana@mail.com',
  },
  materials: [
    {
      id: 'material-1',
      catalogCode: 'TH-DOC-0001',
      title: 'Acta de fundación de la villa',
    },
  ],
});

describe('ListMyRequestsUseCase', () => {
  let listByRequesterUser: jest.Mock<
    ReturnType<RequestRepository['listByRequesterUser']>,
    [string, MyRequestListCriteria]
  >;
  let list: jest.Mock;
  let useCase: ListMyRequestsUseCase;

  beforeEach(() => {
    listByRequesterUser = jest.fn<
      ReturnType<RequestRepository['listByRequesterUser']>,
      [string, MyRequestListCriteria]
    >(() => Promise.resolve({ items: [buildItem()], total: 3 }));
    list = jest.fn();
    useCase = new ListMyRequestsUseCase({
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn(),
      list,
      findById: jest.fn(),
      listByRequesterUser,
      findEntityById: jest.fn(),
      saveStatusChange: jest.fn(),
    });
  });

  it("asks only for the signed-in user's requests, newest first, first page", async () => {
    await useCase.execute({}, 'user-1');

    expect(listByRequesterUser).toHaveBeenCalledWith('user-1', {
      status: undefined,
      sort: 'registeredAt',
      order: 'desc',
      page: 1,
      limit: 20,
    });
  });

  it('never uses the staff list of every request', async () => {
    await useCase.execute({}, 'user-1');

    expect(list).not.toHaveBeenCalled();
  });

  it('passes the status filter, the order and the page', async () => {
    await useCase.execute(
      {
        status: 'AGENDADA',
        sort: 'desiredDate',
        order: 'asc',
        page: 2,
        limit: 5,
      },
      'user-7',
    );

    expect(listByRequesterUser).toHaveBeenCalledWith('user-7', {
      status: 'AGENDADA',
      sort: 'desiredDate',
      order: 'asc',
      page: 2,
      limit: 5,
    });
  });

  it('returns tracking code, dates as text and status, without the requester data', async () => {
    const result = await useCase.execute({ page: 1, limit: 10 }, 'user-1');

    expect(result).toEqual({
      items: [
        {
          id: 'request-1',
          trackingCode: 'SOL-2026-00001',
          status: 'EN_BUSQUEDA',
          deliveryMode: 'DIGITAL',
          desiredDate: '2026-12-01',
          registeredAt: '2026-11-10T15:00:00.000Z',
          materials: [
            {
              id: 'material-1',
              catalogCode: 'TH-DOC-0001',
              title: 'Acta de fundación de la villa',
            },
          ],
          rejectionReason: null,
        },
      ],
      page: 1,
      limit: 10,
      total: 3,
    });
  });

  it('shows the requester the reason of a rejected request (HU-16)', async () => {
    listByRequesterUser.mockResolvedValue({
      items: [
        {
          ...buildItem(),
          status: 'RECHAZADA',
          rejectionReason: 'El material está restringido',
        },
      ],
      total: 1,
    });

    const result = await useCase.execute({}, 'user-1');

    expect(result.items[0]).toMatchObject({
      status: 'RECHAZADA',
      rejectionReason: 'El material está restringido',
    });
  });
});
