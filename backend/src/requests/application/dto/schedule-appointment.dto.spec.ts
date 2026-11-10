import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScheduleAppointmentDto } from './schedule-appointment.dto';

// Same options as the global ValidationPipe (app.setup.ts)
const failedFields = async (plain: Record<string, unknown>) =>
  (
    await validate(plainToInstance(ScheduleAppointmentDto, plain), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((error) => error.property);

describe('ScheduleAppointmentDto', () => {
  it('accepts a date without a time', async () => {
    expect(await failedFields({ date: '2026-11-20' })).toEqual([]);
  });

  it.each([undefined, '', 20261120, '20/11/2026', '2026-11-20T08:00:00Z'])(
    'rejects the date %j',
    async (date) => {
      expect(await failedFields({ date })).toEqual(['date']);
    },
  );

  // The appointment is for the whole day: a time is not part of the body
  it('rejects a time field', async () => {
    expect(
      await failedFields({ date: '2026-11-20', startAt: '08:00' }),
    ).toEqual(['startAt']);
  });
});
