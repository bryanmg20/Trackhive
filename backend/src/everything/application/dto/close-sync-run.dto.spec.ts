import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_SYNC_ERROR_LENGTH } from '../../domain/entities/sync-run.entity';
import { MAX_PAGES_PER_RUN } from '../sync-limits';
import { CloseSyncRunDto } from './close-sync-run.dto';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(CloseSyncRunDto, plain);
const invalidFields = async (plain: Record<string, unknown>) =>
  (await validate(toDto(plain))).map((error) => error.property);

describe('CloseSyncRunDto', () => {
  it('acepta una corrida completa con su número de páginas', async () => {
    expect(await invalidFields({ result: 'OK', pageCount: 4 })).toEqual([]);
  });

  it('acepta una corrida con error y su motivo, sin espacios sobrantes', async () => {
    const dto = toDto({ result: 'ERROR', errorMessage: '  Sin conexión  ' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.errorMessage).toBe('Sin conexión');
  });

  it.each([
    ['sin resultado', {}],
    ['con otro resultado', { result: 'EN_CURSO' }],
  ])('rechaza un cierre %s', async (_case, plain) => {
    expect(await invalidFields(plain)).toContain('result');
  });

  it.each([
    ['sin número de páginas', undefined],
    ['con 0 páginas', 0],
    ['con páginas que no son un entero', 2.5],
    ['con páginas en texto', '4'],
    [`con más de ${MAX_PAGES_PER_RUN} páginas`, MAX_PAGES_PER_RUN + 1],
  ])('rechaza una corrida OK %s', async (_case, pageCount) => {
    expect(await invalidFields({ result: 'OK', pageCount })).toContain(
      'pageCount',
    );
  });

  it.each([
    ['sin motivo', undefined],
    ['con un motivo en blanco', '   '],
    ['con un motivo que no es texto', 42],
    [
      `con un motivo de más de ${MAX_SYNC_ERROR_LENGTH} caracteres`,
      'a'.repeat(MAX_SYNC_ERROR_LENGTH + 1),
    ],
  ])('rechaza una corrida ERROR %s', async (_case, errorMessage) => {
    expect(await invalidFields({ result: 'ERROR', errorMessage })).toContain(
      'errorMessage',
    );
  });
});
