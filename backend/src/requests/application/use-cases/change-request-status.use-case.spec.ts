import { DeliveryMode } from '../../domain/delivery-mode';
import { Request } from '../../domain/entities/request.entity';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import { RequestStatus } from '../../domain/request-status';
import type { StatusChange } from '../../domain/status-change';
import type {
  RequestRepository,
  SavedStatusChange,
} from '../ports/request.repository.port';
import { ChangeRequestStatusUseCase } from './change-request-status.use-case';

const buildRequest = (
  status: RequestStatus,
  deliveryMode: DeliveryMode = 'PRESENCIAL',
): Request => new Request({ id: 'request-1', status, deliveryMode });

// Echoes what it receives, like the database would, with the staff member's name
const savedFrom = (change: StatusChange): SavedStatusChange => ({
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
});

describe('ChangeRequestStatusUseCase', () => {
  let findEntityById: jest.Mock<Promise<Request | null>, [string]>;
  let saveStatusChange: jest.Mock<Promise<SavedStatusChange>, [StatusChange]>;
  let useCase: ChangeRequestStatusUseCase;

  beforeEach(() => {
    findEntityById = jest.fn<Promise<Request | null>, [string]>(() =>
      Promise.resolve(buildRequest('AGENDADA')),
    );
    saveStatusChange = jest.fn<Promise<SavedStatusChange>, [StatusChange]>(
      (change) => Promise.resolve(savedFrom(change)),
    );
    const repository: RequestRepository = {
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      listByRequesterUser: jest.fn(),
      findEntityById,
      saveStatusChange,
    };
    useCase = new ChangeRequestStatusUseCase(repository);
  });

  it('saves the date and time, the responsible and the comment of the change', async () => {
    const before = Date.now();

    await useCase.execute({
      requestId: 'request-1',
      status: 'ATENDIDA',
      comment: 'Consultó las actas en la sala',
      userId: 'staff-1',
    });

    expect(findEntityById).toHaveBeenCalledWith('request-1');
    expect(saveStatusChange).toHaveBeenCalledTimes(1);
    const saved = saveStatusChange.mock.calls[0][0];
    expect(saved).toMatchObject({
      requestId: 'request-1',
      previousStatus: 'AGENDADA',
      newStatus: 'ATENDIDA',
      changedBy: 'staff-1',
      comment: 'Consultó las actas en la sala',
    });
    expect(saved.changedAt).toBeInstanceOf(Date);
    expect(saved.changedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('accepts a change without a comment', async () => {
    await useCase.execute({
      requestId: 'request-1',
      status: 'ATENDIDA',
      userId: 'staff-1',
    });

    expect(saveStatusChange.mock.calls[0][0].comment).toBeNull();
  });

  it('returns the new status, its next transitions and the saved record', async () => {
    const result = await useCase.execute({
      requestId: 'request-1',
      status: 'ATENDIDA',
      userId: 'staff-1',
    });

    expect(result).toEqual({
      id: 'request-1',
      status: 'ATENDIDA',
      allowedTransitions: ['CERRADA'],
      statusChange: {
        previousStatus: 'AGENDADA',
        newStatus: 'ATENDIDA',
        changedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ) as unknown,
        changedBy: { id: 'staff-1', name: 'Ana María Gómez' },
        comment: null,
      },
    });
  });

  it('moves a scheduled request back to DISPONIBLE when the requester did not attend', async () => {
    const result = await useCase.execute({
      requestId: 'request-1',
      status: 'DISPONIBLE',
      comment: 'No asistió a la cita',
      userId: 'staff-1',
    });

    expect(result.status).toBe('DISPONIBLE');
    expect(result.allowedTransitions).toEqual(['AGENDADA', 'CERRADA']);
    expect(saveStatusChange.mock.calls[0][0]).toMatchObject({
      previousStatus: 'AGENDADA',
      newStatus: 'DISPONIBLE',
    });
  });

  it('throws RequestNotFoundError and saves nothing when the request does not exist', async () => {
    findEntityById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        requestId: 'missing',
        status: 'EN_BUSQUEDA',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(RequestNotFoundError);
    expect(saveStatusChange).not.toHaveBeenCalled();
  });

  it('throws InvalidStatusTransitionError and saves nothing for an invalid transition', async () => {
    findEntityById.mockResolvedValue(buildRequest('RECIBIDA'));

    await expect(
      useCase.execute({
        requestId: 'request-1',
        status: 'ATENDIDA',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(InvalidStatusTransitionError);
    expect(saveStatusChange).not.toHaveBeenCalled();
  });

  it.each<RequestStatus>(['CERRADA', 'RECHAZADA'])(
    'does not change a request in the final status %s',
    async (finalStatus) => {
      findEntityById.mockResolvedValue(buildRequest(finalStatus));

      await expect(
        useCase.execute({
          requestId: 'request-1',
          status: 'DISPONIBLE',
          userId: 'staff-1',
        }),
      ).rejects.toThrow(InvalidStatusTransitionError);
      expect(saveStatusChange).not.toHaveBeenCalled();
    },
  );

  it('lets the conflict of a concurrent change reach the caller', async () => {
    saveStatusChange.mockRejectedValue(new RequestStatusConflictError());

    await expect(
      useCase.execute({
        requestId: 'request-1',
        status: 'ATENDIDA',
        userId: 'staff-1',
      }),
    ).rejects.toThrow(RequestStatusConflictError);
  });
});
