import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRequestOnBehalfDto } from './create-request-on-behalf.dto';

const base = () => ({
  materialIds: ['c3f6c8f0-1c2b-4e3d-8f4a-123456789abc'],
  reason: 'Consulta para un trabajo de investigación',
  desiredDate: '2026-12-15',
  deliveryMode: 'PRESENCIAL',
});

describe('CreateRequestOnBehalfDto', () => {
  it('requires the requester email', async () => {
    const dto = plainToInstance(CreateRequestOnBehalfDto, {
      ...base(),
      requester: {
        firstName: 'Visitante',
        lastName: 'Prueba',
      },
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'requester')).toBe(true);
  });

  it('requires names when there is no associated user', async () => {
    const dto = plainToInstance(CreateRequestOnBehalfDto, {
      ...base(),
      requester: {
        email: 'visitante@ejemplo.com',
      },
    });

    const errors = await validate(dto);

    const requesterErrors = errors.find(
      (error) => error.property === 'requester',
    );
    expect(requesterErrors?.children?.map((child) => child.property)).toEqual(
      expect.arrayContaining(['firstName', 'lastName']),
    );
  });

  it('accepts an associated user without repeating the names', async () => {
    const dto = plainToInstance(CreateRequestOnBehalfDto, {
      ...base(),
      requester: {
        email: 'visitante@ejemplo.com',
        userId: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid requester email', async () => {
    const dto = plainToInstance(CreateRequestOnBehalfDto, {
      ...base(),
      requester: {
        email: 'no-es-correo',
        firstName: 'Visitante',
        lastName: 'Prueba',
      },
    });

    const errors = await validate(dto);

    const requesterErrors = errors.find(
      (error) => error.property === 'requester',
    );
    expect(requesterErrors?.children?.map((child) => child.property)).toContain(
      'email',
    );
  });
});
