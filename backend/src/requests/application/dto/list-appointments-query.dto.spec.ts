import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListAppointmentsQueryDto } from './list-appointments-query.dto';

const check = async (plain: Record<string, unknown>) =>
  validate(plainToInstance(ListAppointmentsQueryDto, plain));

describe('ListAppointmentsQueryDto', () => {
  it('accepts an empty query', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it('accepts every filter together', async () => {
    const errors = await check({
      status: 'PROGRAMADA',
      from: '2026-11-01',
      to: '2026-12-31',
      requester: 'juan',
      material: 'cabildo',
      sort: 'appointmentDate',
      order: 'asc',
      page: '2',
      limit: '50',
    });

    expect(errors).toHaveLength(0);
  });

  it.each([
    ['status', 'ROTA'],
    ['from', '01/11/2026'],
    ['from', '2026-13-45'],
    ['to', '2026-12-01T10:00:00Z'],
    ['sort', 'status'],
    ['order', 'up'],
    ['page', '0'],
    ['limit', '101'],
    ['requester', 'a'.repeat(101)],
    ['material', 'a'.repeat(101)],
  ])('rejects %s = %s', async (field, value) => {
    const errors = await check({ [field]: value });

    expect(errors.map((error) => error.property)).toContain(field);
  });

  it('treats empty text as no filter', async () => {
    const dto = plainToInstance(ListAppointmentsQueryDto, {
      requester: '   ',
      material: '',
      from: '',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.requester).toBeUndefined();
    expect(dto.material).toBeUndefined();
    expect(dto.from).toBeUndefined();
  });
});
