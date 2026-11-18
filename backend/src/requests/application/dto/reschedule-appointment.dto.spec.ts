import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RescheduleAppointmentDto } from './reschedule-appointment.dto';

const failedFields = async (plain: Record<string, unknown>) =>
  (
    await validate(plainToInstance(RescheduleAppointmentDto, plain), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((error) => error.property);

describe('RescheduleAppointmentDto (HU-21)', () => {
  it('accepts a valid date and optional comment', async () => {
    expect(await failedFields({ date: '2026-11-24' })).toEqual([]);
    expect(
      await failedFields({ date: '2026-11-24', comment: 'Cambio de fecha' }),
    ).toEqual([]);
    const blankComment = plainToInstance(RescheduleAppointmentDto, {
      date: '2026-11-24',
      comment: '   ',
    });
    expect(blankComment.comment).toBeUndefined();
  });

  it.each([undefined, '', 20261124, '24/11/2026'])(
    'rejects invalid date %j',
    async (date) => {
      expect(await failedFields({ date })).toEqual(['date']);
    },
  );

  it('rejects a comment over 500 chars or non-string', async () => {
    expect(
      await failedFields({ date: '2026-11-24', comment: 'a'.repeat(501) }),
    ).toEqual(['comment']);
    expect(await failedFields({ date: '2026-11-24', comment: 123 })).toEqual([
      'comment',
    ]);
  });
});
