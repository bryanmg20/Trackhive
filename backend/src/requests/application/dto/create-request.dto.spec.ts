import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateRequestDto } from './create-request.dto';

describe('CreateRequestDto', () => {
  it('rejects material IDs that are not UUID v4 values', async () => {
    const dto = Object.assign(new CreateRequestDto(), {
      materialIds: ['not-a-uuid'],
      reason: 'Consulta de investigación',
      desiredDate: '2026-12-15',
      deliveryMode: 'PRESENCIAL',
    });

    const errors = await validate(dto);

    expect(
      errors.find((error) => error.property === 'materialIds')?.constraints,
    ).toHaveProperty('isUuid');
  });
});

describe('CreateRequestDto written references (HU-09.2)', () => {
  const base = {
    reason: 'Consulta de investigación',
    desiredDate: '2026-12-15',
    deliveryMode: 'PRESENCIAL',
  };

  it('accepts a request without catalog materials but with a reference', async () => {
    const dto = plainToInstance(CreateRequestDto, {
      ...base,
      references: [
        { kind: 'TEXTO_LIBRE', description: 'El Heraldo, 15-03-1950' },
      ],
    });

    expect(await validate(dto)).toEqual([]);
  });

  it('requires notary, year and deed number for a notarial protocol', async () => {
    const dto = plainToInstance(CreateRequestDto, {
      ...base,
      references: [{ kind: 'PROTOCOLO_NOTARIAL' }],
    });

    const [error] = await validate(dto);

    expect(error.property).toBe('references');
    const fields = error.children?.[0].children?.map((child) => child.property);
    expect(fields).toEqual(['notary', 'year', 'deedNumber']);
  });

  it('rejects an unknown kind of reference', async () => {
    const dto = plainToInstance(CreateRequestDto, {
      ...base,
      references: [{ kind: 'OTRO', description: 'algo' }],
    });

    const [error] = await validate(dto);

    expect(error.children?.[0].children?.[0].constraints).toHaveProperty(
      'isIn',
    );
  });
});
