import { RequestAccessForbiddenError } from '../../domain/errors/request-access-forbidden.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import type {
  IRequestQueryService,
  RequestHistory,
} from '../ports/request-query.port';
import { GetRequestHistoryUseCase } from './get-request-history.use-case';

const OWNER_ID = 'user-owner';
const STAFF_ID = 'user-staff';

const buildHistory = (
  overrides: Partial<RequestHistory> = {},
): RequestHistory => ({
  requestId: 'request-1',
  trackingCode: 'SOL-2026-00001',
  requesterUserId: OWNER_ID,
  entries: [
    {
      id: '1',
      previousStatus: null,
      newStatus: 'RECIBIDA',
      changedAt: new Date('2026-11-10T15:00:00.000Z'),
      comment: null,
      visibleToRequester: true,
      changedBy: {
        id: OWNER_ID,
        firstName: 'Juan',
        middleName: 'Carlos',
        lastName: 'Pérez',
        secondLastName: null,
      },
    },
    {
      id: '2',
      previousStatus: 'RECIBIDA',
      newStatus: 'EN_BUSQUEDA',
      changedAt: new Date('2026-11-11T09:00:00.000Z'),
      comment: 'Se busca en el depósito 1',
      visibleToRequester: true,
      changedBy: {
        id: STAFF_ID,
        firstName: 'Ana',
        middleName: 'María',
        lastName: 'Gómez',
        secondLastName: null,
      },
    },
    {
      id: '3',
      previousStatus: 'EN_BUSQUEDA',
      newStatus: 'DISPONIBLE',
      changedAt: new Date('2026-11-12T09:00:00.000Z'),
      comment: 'Nota interna',
      visibleToRequester: false,
      changedBy: {
        id: STAFF_ID,
        firstName: 'Ana',
        middleName: 'María',
        lastName: 'Gómez',
        secondLastName: null,
      },
    },
  ],
  ...overrides,
});

describe('GetRequestHistoryUseCase', () => {
  const setup = (history: RequestHistory | null = buildHistory()) => {
    const findHistory = jest.fn().mockResolvedValue(history);
    const queries = { findHistory } as unknown as IRequestQueryService;
    return { findHistory, useCase: new GetRequestHistoryUseCase(queries) };
  };

  it.each(['PERSONAL', 'ADMIN'] as const)(
    'gives %s every row, oldest first, with the full name of who made it',
    async (role) => {
      const { findHistory, useCase } = setup();

      const result = await useCase.execute({
        requestId: 'request-1',
        viewer: { id: 'someone-else', role },
      });

      expect(findHistory).toHaveBeenCalledWith('request-1');
      expect(result).toEqual({
        requestId: 'request-1',
        trackingCode: 'SOL-2026-00001',
        entries: [
          {
            id: '1',
            previousStatus: null,
            newStatus: 'RECIBIDA',
            changedAt: '2026-11-10T15:00:00.000Z',
            changedBy: 'Juan Carlos Pérez',
            comment: null,
          },
          {
            id: '2',
            previousStatus: 'RECIBIDA',
            newStatus: 'EN_BUSQUEDA',
            changedAt: '2026-11-11T09:00:00.000Z',
            changedBy: 'Ana María Gómez',
            comment: 'Se busca en el depósito 1',
          },
          {
            id: '3',
            previousStatus: 'EN_BUSQUEDA',
            newStatus: 'DISPONIBLE',
            changedAt: '2026-11-12T09:00:00.000Z',
            changedBy: 'Ana María Gómez',
            comment: 'Nota interna',
          },
        ],
      });
    },
  );

  it('gives the owner their history without internal rows nor staff names', async () => {
    const { useCase } = setup();

    const result = await useCase.execute({
      requestId: 'request-1',
      viewer: { id: OWNER_ID, role: 'PUBLICO' },
    });

    expect(result.entries).toEqual([
      expect.objectContaining({
        newStatus: 'RECIBIDA',
        changedBy: 'Juan Carlos Pérez',
      }),
      expect.objectContaining({
        newStatus: 'EN_BUSQUEDA',
        changedBy: 'Personal del CLENA',
        comment: 'Se busca en el depósito 1',
      }),
    ]);
  });

  it('rejects a public user who is not the owner', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        requestId: 'request-1',
        viewer: { id: 'another-user', role: 'PUBLICO' },
      }),
    ).rejects.toBeInstanceOf(RequestAccessForbiddenError);
  });

  it("rejects a public user for a visitor's request, which has no account", async () => {
    const { useCase } = setup(buildHistory({ requesterUserId: null }));

    await expect(
      useCase.execute({
        requestId: 'request-1',
        viewer: { id: OWNER_ID, role: 'PUBLICO' },
      }),
    ).rejects.toBeInstanceOf(RequestAccessForbiddenError);
  });

  it('throws RequestNotFoundError when the request does not exist', async () => {
    const { useCase } = setup(null);

    await expect(
      useCase.execute({
        requestId: 'missing',
        viewer: { id: STAFF_ID, role: 'PERSONAL' },
      }),
    ).rejects.toBeInstanceOf(RequestNotFoundError);
  });
});
