import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_PAGES_PER_RUN } from '../sync-limits';
import { SyncPageParamsDto } from './sync-page-params.dto';

const RUN_ID = '0b6a8f1e-3c2d-4e5f-9a8b-7c6d5e4f3a2b';

// Route params always arrive as text
const toDto = (plain: Record<string, string>) =>
  plainToInstance(SyncPageParamsDto, plain);
const invalidFields = async (plain: Record<string, string>) =>
  (await validate(toDto(plain))).map((error) => error.property);

describe('SyncPageParamsDto', () => {
  it('convierte el número de página de la ruta a número', async () => {
    const dto = toDto({ runId: RUN_ID, pageNumber: '3' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.pageNumber).toBe(3);
  });

  it('rechaza una corrida que no es un UUID', async () => {
    expect(
      await invalidFields({ runId: 'corrida-1', pageNumber: '1' }),
    ).toEqual(['runId']);
  });

  it.each(['0', '-1', '1.5', 'uno', String(MAX_PAGES_PER_RUN + 1)])(
    'rechaza la página %s',
    async (pageNumber) => {
      expect(await invalidFields({ runId: RUN_ID, pageNumber })).toEqual([
        'pageNumber',
      ]);
    },
  );
});
