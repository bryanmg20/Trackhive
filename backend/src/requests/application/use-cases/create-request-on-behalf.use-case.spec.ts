import { addBusinessDays, todayInBogota } from '../../domain/desired-date';
import { DesiredDateError } from '../../domain/errors/desired-date-invalid.error';
import { RequestMaterialsRequiredError } from '../../domain/errors/request-materials-required.error';
import { RequesterEmailRequiredError } from '../../domain/errors/requester-email-required.error';
import { RequesterNameRequiredError } from '../../domain/errors/requester-name-required.error';
import type { CreateRequestOnBehalfInput } from './create-request-on-behalf.use-case';
import { CreateRequestOnBehalfUseCase } from './create-request-on-behalf.use-case';

const validDate = () =>
  addBusinessDays(todayInBogota(), 10).toISOString().slice(0, 10);

describe('CreateRequestOnBehalfUseCase', () => {
  const repository = {
    create: jest.fn(),
    createOnBehalf: jest.fn().mockResolvedValue({
      id: 'request-1',
      trackingCode: 'SOL-2026-00001',
      status: 'RECIBIDA',
    }),
    findRequesterByEmail: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    listByRequesterUser: jest.fn(),
  };
  const useCase = new CreateRequestOnBehalfUseCase(repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const input = (): CreateRequestOnBehalfInput => ({
    materialIds: ['material-1'],
    reason: 'Consulta para un trabajo de investigación',
    desiredDate: validDate(),
    deliveryMode: 'PRESENCIAL' as const,
    requester: {
      email: 'visitante@ejemplo.com',
      firstName: 'Visitante',
      lastName: 'Prueba',
    },
  });

  it('registers the request with the staff member as creator', async () => {
    await useCase.execute(input(), 'staff-1');

    expect(repository.createOnBehalf).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById: 'staff-1',
        requester: expect.objectContaining({
          email: 'visitante@ejemplo.com',
        }) as unknown,
      }),
    );
  });

  it('accepts an existing user without repeating the names', async () => {
    const data = input();
    data.requester = {
      email: 'visitante@ejemplo.com',
      userId: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
    };

    await useCase.execute(data, 'staff-1');

    expect(repository.createOnBehalf).toHaveBeenCalled();
  });

  it('rejects a date earlier than ten business days', async () => {
    const data = input();
    data.desiredDate = addBusinessDays(todayInBogota(), 1)
      .toISOString()
      .slice(0, 10);

    await expect(useCase.execute(data, 'staff-1')).rejects.toBeInstanceOf(
      DesiredDateError,
    );
    expect(repository.createOnBehalf).not.toHaveBeenCalled();
  });

  it('rejects a request without materials', async () => {
    const data = input();
    data.materialIds = [];

    await expect(useCase.execute(data, 'staff-1')).rejects.toBeInstanceOf(
      RequestMaterialsRequiredError,
    );
  });

  it('rejects a request without requester email', async () => {
    const data = input();
    data.requester.email = '   ';

    await expect(useCase.execute(data, 'staff-1')).rejects.toBeInstanceOf(
      RequesterEmailRequiredError,
    );
  });

  it('rejects a new requester without names', async () => {
    const data = input();
    data.requester.firstName = '';
    data.requester.lastName = '';

    await expect(useCase.execute(data, 'staff-1')).rejects.toBeInstanceOf(
      RequesterNameRequiredError,
    );
  });
});
