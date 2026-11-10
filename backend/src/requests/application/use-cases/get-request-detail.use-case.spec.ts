import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import type {
  RequestDetail,
  RequestRepository,
} from '../ports/request.repository.port';
import { GetRequestDetailUseCase } from './get-request-detail.use-case';

const buildDetail = (
  overrides: Partial<RequestDetail> = {},
): RequestDetail => ({
  id: 'request-1',
  trackingCode: 'SOL-2026-00001',
  status: 'AGENDADA',
  deliveryMode: 'PRESENCIAL',
  originChannel: 'WEB',
  reason: 'Consulta para un trabajo de investigación',
  requirementDescription: 'Actas de 1810',
  desiredDate: new Date('2026-12-01T00:00:00.000Z'),
  committedDate: new Date('2026-12-03T00:00:00.000Z'),
  registeredAt: new Date('2026-11-10T15:00:00.000Z'),
  rejectionReason: null,
  requester: {
    firstName: 'Juan',
    middleName: 'Carlos',
    lastName: 'Pérez',
    secondLastName: null,
    email: 'juan@mail.com',
    phone: '3001234567',
    requesterType: 'INVESTIGADOR',
    institution: 'Universidad de Antioquia',
    documentType: 'CC',
    documentNumber: '123456789',
  },
  materials: [
    {
      id: 'material-1',
      catalogCode: 'TH-DOC-0001',
      title: 'Acta de fundación de la villa',
      materialType: 'DOCUMENTO',
      author: null,
      collection: 'Actas del Cabildo',
      status: 'DISPONIBLE',
      location: { depot: 'D-01', shelf: 'E-01', box: 'C-001' },
      itemStatus: 'LOCALIZADO',
    },
  ],
  ...overrides,
});

describe('GetRequestDetailUseCase', () => {
  let findById: jest.Mock<Promise<RequestDetail | null>, [string]>;
  let useCase: GetRequestDetailUseCase;

  beforeEach(() => {
    findById = jest.fn<Promise<RequestDetail | null>, [string]>(() =>
      Promise.resolve(buildDetail()),
    );
    const repository: RequestRepository = {
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn(),
      list: jest.fn(),
      findById,
      listByRequesterUser: jest.fn(),
      findEntityById: jest.fn(),
      saveStatusChange: jest.fn(),
    };
    useCase = new GetRequestDetailUseCase(repository);
  });

  it('returns requester, material, reason, desired date and status', async () => {
    const result = await useCase.execute('request-1');

    expect(findById).toHaveBeenCalledWith('request-1');
    expect(result).toMatchObject({
      trackingCode: 'SOL-2026-00001',
      status: 'AGENDADA',
      reason: 'Consulta para un trabajo de investigación',
      desiredDate: '2026-12-01',
      committedDate: '2026-12-03',
      registeredAt: '2026-11-10T15:00:00.000Z',
      requester: {
        name: 'Juan Carlos Pérez',
        email: 'juan@mail.com',
        phone: '3001234567',
        requesterType: 'INVESTIGADOR',
        institution: 'Universidad de Antioquia',
        documentType: 'CC',
        documentNumber: '123456789',
      },
    });
    expect(result.materials).toEqual([
      expect.objectContaining({
        catalogCode: 'TH-DOC-0001',
        title: 'Acta de fundación de la villa',
        status: 'DISPONIBLE',
        location: { depot: 'D-01', shelf: 'E-01', box: 'C-001' },
        itemStatus: 'LOCALIZADO',
      }),
    ]);
  });

  it('sends no committed date when the request is not scheduled', async () => {
    findById.mockResolvedValue(
      buildDetail({ status: 'RECIBIDA', committedDate: null }),
    );

    const result = await useCase.execute('request-1');

    expect(result.committedDate).toBeNull();
  });

  it('returns the rejection reason of a rejected request', async () => {
    findById.mockResolvedValue(
      buildDetail({
        status: 'RECHAZADA',
        rejectionReason: 'Material no localizado',
      }),
    );

    const result = await useCase.execute('request-1');

    expect(result.status).toBe('RECHAZADA');
    expect(result.rejectionReason).toBe('Material no localizado');
  });

  it.each<[RequestDetail['status'], RequestDetail['deliveryMode'], string[]]>([
    ['RECIBIDA', 'PRESENCIAL', ['EN_BUSQUEDA', 'RECHAZADA']],
    ['DISPONIBLE', 'PRESENCIAL', ['AGENDADA', 'CERRADA']],
    ['DISPONIBLE', 'DIGITAL', ['ATENDIDA', 'CERRADA']],
    ['AGENDADA', 'PRESENCIAL', ['DISPONIBLE', 'ATENDIDA']],
    ['CERRADA', 'PRESENCIAL', []],
  ])(
    'lists the valid next statuses of a %s (%s) request (HU-15)',
    async (status, deliveryMode, expected) => {
      findById.mockResolvedValue(buildDetail({ status, deliveryMode }));

      const result = await useCase.execute('request-1');

      expect(result.allowedTransitions).toEqual(expected);
    },
  );

  it('throws RequestNotFoundError when the request does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(
      RequestNotFoundError,
    );
  });
});
