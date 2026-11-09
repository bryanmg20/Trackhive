import { validate } from 'class-validator';
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
