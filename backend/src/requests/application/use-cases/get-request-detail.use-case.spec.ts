import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import type {
  RequestDetail,
  IRequestQueryService,
} from '../ports/request-query.port';
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
      itemStatus: 'LOCALIZADO',
      hasDigitalCopy: false,
      digitalFolderName: null,
      needsReview: false,
      reviewReason: null,
    },
  ],
  references: [],
  ...overrides,
});

// A catalog material of the detail with its digital copy and status (HU-139)
const material = (
  id: string,
  hasDigitalCopy: boolean,
  status = 'DISPONIBLE',
): RequestDetail['materials'][number] => ({
  id,
  catalogCode: `TH-PER-${id}`,
  title: 'La Gaceta Ribereña - 1931 a 1933',
  materialType: 'PERIODICO',
  author: null,
  collection: 'Periódicos',
  status,
  itemStatus: 'PENDIENTE',
  hasDigitalCopy,
  digitalFolderName: hasDigitalCopy ? `folder-${id}` : null,
  needsReview: false,
  reviewReason: null,
});

describe('GetRequestDetailUseCase', () => {
  let findById: jest.Mock<Promise<RequestDetail | null>, [string]>;
  let useCase: GetRequestDetailUseCase;

  beforeEach(() => {
    findById = jest.fn<Promise<RequestDetail | null>, [string]>(() =>
      Promise.resolve(buildDetail()),
    );
    const repository: IRequestQueryService = {
      findRequesterByEmail: jest.fn(),
      list: jest.fn(),
      listAppointments: jest.fn(),
      findHistory: jest.fn(),
      findDetail: findById,
      listByRequesterUser: jest.fn(),
      findNotificationContext: jest.fn(),
      findSchedulingConflicts: jest.fn(),
      findMissingMaterialIds: jest.fn(),
      countActiveAppointmentsOnDate: jest.fn(),
      countActiveAppointmentsByDateRange: jest.fn(),
    };
    useCase = new GetRequestDetailUseCase(repository);
  });

  it('returns requester, material, reason, desired date and status', async () => {
    const result = await useCase.execute({ id: 'request-1' });

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
        itemStatus: 'LOCALIZADO',
        hasDigitalCopy: false,
        digitalFolderName: null,
        needsReview: false,
        reviewReason: null,
      }),
    ]);
  });

  it('includes the Everything folder name and review reason in materials (HU-140)', async () => {
    findById.mockResolvedValue(
      buildDetail({
        materials: [
          {
            ...material('1', true),
            digitalFolderName: '1ra-1931 - Esc 0001-0109 - Ene',
            needsReview: true,
            reviewReason: 'NO_PATTERN',
          },
          {
            ...material('2', true),
            digitalFolderName: '1ra-1940 - Esc 1-161 - Ene',
            needsReview: true,
            reviewReason: 'DUPLICATE_CODE',
          },
        ],
      }),
    );

    const result = await useCase.execute({ id: 'request-1' });

    expect(result.materials[0]).toMatchObject({
      hasDigitalCopy: true,
      digitalFolderName: '1ra-1931 - Esc 0001-0109 - Ene',
      needsReview: true,
      reviewReason: 'NO_PATTERN',
    });
    expect(result.materials[1]).toMatchObject({
      hasDigitalCopy: true,
      digitalFolderName: '1ra-1940 - Esc 1-161 - Ene',
      needsReview: true,
      reviewReason: 'DUPLICATE_CODE',
    });
  });

  it('sends no committed date when the request is not scheduled', async () => {
    findById.mockResolvedValue(
      buildDetail({ status: 'RECIBIDA', committedDate: null }),
    );

    const result = await useCase.execute({ id: 'request-1' });

    expect(result.committedDate).toBeNull();
  });

  it('returns the rejection reason of a rejected request', async () => {
    findById.mockResolvedValue(
      buildDetail({
        status: 'RECHAZADA',
        rejectionReason: 'Material no localizado',
      }),
    );

    const result = await useCase.execute({ id: 'request-1' });

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

      const result = await useCase.execute({ id: 'request-1' });

      expect(result.allowedTransitions).toEqual(expected);
    },
  );

  describe('written references (HU-09.2)', () => {
    const reference = (
      status: 'PENDIENTE' | 'RESUELTA',
    ): RequestDetail['references'][number] => ({
      id: 'reference-1',
      kind: 'TEXTO_LIBRE',
      notary: null,
      year: null,
      deedNumber: null,
      description: 'El Heraldo, 15-03-1950',
      status,
      materialId: status === 'RESUELTA' ? 'material-9' : null,
      material:
        status === 'RESUELTA'
          ? {
              id: 'material-9',
              catalogCode: 'TH-PER-0101',
              title: 'El Heraldo',
            }
          : null,
      resolvedAt: null,
      resolvedBy: null,
    });

    it('asks for the comment of DISPONIBLE when EN_BUSQUEDA has a reference without material', async () => {
      findById.mockResolvedValue(
        buildDetail({
          status: 'EN_BUSQUEDA',
          references: [reference('PENDIENTE')],
        }),
      );

      const result = await useCase.execute({ id: 'request-1' });

      expect(result.commentRequiredFor).toEqual(['DISPONIBLE', 'RECHAZADA']);
      expect(result.canResolveReferences).toBe(true);
      expect(result.references[0]).toMatchObject({
        displayStatus: 'PENDIENTE',
      });
    });

    it('only asks for the reason of RECHAZADA once every reference is resolved', async () => {
      findById.mockResolvedValue(
        buildDetail({
          status: 'EN_BUSQUEDA',
          references: [reference('RESUELTA')],
        }),
      );

      const result = await useCase.execute({ id: 'request-1' });

      expect(result.commentRequiredFor).toEqual(['RECHAZADA']);
      expect(result.references[0]).toMatchObject({ displayStatus: 'RESUELTA' });
    });

    it('shows a reference without material as SIN_MATERIAL past EN_BUSQUEDA, without association', async () => {
      findById.mockResolvedValue(
        buildDetail({
          status: 'DISPONIBLE',
          references: [reference('PENDIENTE')],
        }),
      );

      const result = await useCase.execute({ id: 'request-1' });

      expect(result.canResolveReferences).toBe(false);
      expect(result.commentRequiredFor).toEqual([]);
      expect(result.references[0]).toMatchObject({
        status: 'PENDIENTE',
        displayStatus: 'SIN_MATERIAL',
      });
    });
  });

  describe('direct DISPONIBLE with a digital copy (HU-139)', () => {
    const received = (materials: RequestDetail['materials']) =>
      buildDetail({
        status: 'RECIBIDA',
        deliveryMode: 'DIGITAL',
        committedDate: null,
        materials,
      });

    it('offers DISPONIBLE and RECHAZADA when every material has a consultable copy, one being restored', async () => {
      findById.mockResolvedValue(
        received([material('1', true), material('2', true, 'EN_RESTAURACION')]),
      );

      const result = await useCase.execute({ id: 'request-1' });

      expect(result.allowedTransitions).toEqual(['DISPONIBLE', 'RECHAZADA']);
      expect(result.commentRequiredFor).toEqual(['RECHAZADA']);
      expect(result.materials.map((item) => item.hasDigitalCopy)).toEqual([
        true,
        true,
      ]);
    });

    it.each([
      [
        'a material is not consultable',
        [material('1', true, 'NO_CONSULTABLE')],
      ],
      ['a material has no copy', [material('1', true), material('2', false)]],
    ])('keeps EN_BUSQUEDA when %s', async (_case, materials) => {
      findById.mockResolvedValue(received(materials));

      const result = await useCase.execute({ id: 'request-1' });

      expect(result.allowedTransitions).toEqual(['EN_BUSQUEDA', 'RECHAZADA']);
    });

    it('keeps EN_BUSQUEDA for a presential delivery with every copy', async () => {
      findById.mockResolvedValue(
        buildDetail({
          status: 'RECIBIDA',
          deliveryMode: 'PRESENCIAL',
          materials: [material('1', true)],
        }),
      );

      const result = await useCase.execute({ id: 'request-1' });

      expect(result.allowedTransitions).toEqual(['EN_BUSQUEDA', 'RECHAZADA']);
    });
  });

  it('throws RequestNotFoundError when the request does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(
      RequestNotFoundError,
    );
  });
});
