import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CancelAppointmentDto } from './cancel-appointment.dto';

const failedFields = async (plain: Record<string, unknown>) =>
  (
    await validate(plainToInstance(CancelAppointmentDto, plain), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((error) => error.property);

describe('CancelAppointmentDto (HU-21)', () => {
  it('accepts an empty body or an optional comment', async () => {
    expect(await failedFields({})).toEqual([]);
    expect(await failedFields({ comment: 'Motivo de cancelación' })).toEqual(
      [],
    );
    const blankComment = plainToInstance(CancelAppointmentDto, {
      comment: '   ',
    });
    expect(blankComment.comment).toBeUndefined();
  });

  it('rejects a comment over 500 chars or non-string', async () => {
    expect(await failedFields({ comment: 'a'.repeat(501) })).toEqual([
      'comment',
    ]);
    expect(await failedFields({ comment: 123 })).toEqual(['comment']);
  });
});
