import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MAX_LOAN_NOTES_LENGTH,
  ReturnMaterialDto,
} from './return-material.dto';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(ReturnMaterialDto, plain);

describe('ReturnMaterialDto', () => {
  it('accepts an empty body', async () => {
    expect(await validate(toDto({}))).toHaveLength(0);
  });

  it('trims notes and treats blank text as undefined', async () => {
    const trimmed = toDto({ notes: '  Completo  ' });
    expect(trimmed.notes).toBe('Completo');
    expect(await validate(trimmed)).toHaveLength(0);

    const blank = toDto({ notes: '   ' });
    expect(blank.notes).toBeUndefined();
    expect(await validate(blank)).toHaveLength(0);
  });

  it('rejects notes longer than the maximum or non-strings', async () => {
    const tooLong = await validate(
      toDto({ notes: 'a'.repeat(MAX_LOAN_NOTES_LENGTH + 1) }),
    );
    expect(tooLong.map((e) => e.property)).toContain('notes');

    const nonString = await validate(toDto({ notes: 123 }));
    expect(nonString.map((e) => e.property)).toContain('notes');
  });
});
