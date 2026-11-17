import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MATERIAL_STATUSES } from '../../domain/enums/material-status';
import {
  ChangeMaterialStatusDto,
  MAX_STATUS_REASON_LENGTH,
} from './change-material-status.dto';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(ChangeMaterialStatusDto, plain);

const check = async (plain: Record<string, unknown>) => validate(toDto(plain));

describe('ChangeMaterialStatusDto', () => {
  it.each(MATERIAL_STATUSES)('accepts the status %s', async (status) => {
    expect(await check({ status })).toHaveLength(0);
  });

  it('accepts a reason at the maximum length', async () => {
    const errors = await check({
      status: 'EN_RESTAURACION',
      reason: 'a'.repeat(MAX_STATUS_REASON_LENGTH),
    });

    expect(errors).toHaveLength(0);
  });

  it('trims the reason', () => {
    const dto = toDto({ status: 'EN_USO', reason: '  Humedad en la caja  ' });

    expect(dto.reason).toBe('Humedad en la caja');
  });

  it('treats a blank reason as no reason', async () => {
    const dto = toDto({ status: 'EN_USO', reason: '   ' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.reason).toBeUndefined();
  });

  it.each([
    ['a missing status', {}],
    ['an unknown status', { status: 'ROTO' }],
  ])('rejects %s', async (_case, plain) => {
    const errors = await check(plain);

    expect(errors.map((error) => error.property)).toContain('status');
  });

  it.each([
    ['too long', 'a'.repeat(MAX_STATUS_REASON_LENGTH + 1)],
    ['not text', 42],
  ])('rejects a reason that is %s', async (_case, reason) => {
    const errors = await check({ status: 'EN_USO', reason });

    expect(errors.map((error) => error.property)).toContain('reason');
  });
});
