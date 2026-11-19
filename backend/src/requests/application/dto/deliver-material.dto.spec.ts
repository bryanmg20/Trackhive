import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_LOAN_NOTES_LENGTH } from '../../../materials/application/dto/return-material.dto';
import { DeliverMaterialDto } from './deliver-material.dto';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(DeliverMaterialDto, plain);

describe('DeliverMaterialDto', () => {
  it('accepts an empty body and trims notes', async () => {
    expect(await validate(toDto({}))).toHaveLength(0);

    const dto = toDto({ notes: '  En sala 1  ' });
    expect(dto.notes).toBe('En sala 1');
    expect(await validate(dto)).toHaveLength(0);

    const blank = toDto({ notes: '   ' });
    expect(blank.notes).toBeUndefined();
    expect(await validate(blank)).toHaveLength(0);
  });

  it('rejects overly long or non-string notes', async () => {
    const errors = await validate(
      toDto({ notes: 'x'.repeat(MAX_LOAN_NOTES_LENGTH + 1) }),
    );
    expect(errors.map((e) => e.property)).toContain('notes');

    const badType = await validate(toDto({ notes: 99 }));
    expect(badType.map((e) => e.property)).toContain('notes');
  });
});
