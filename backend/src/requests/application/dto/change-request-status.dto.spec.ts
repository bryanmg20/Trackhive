import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ChangeRequestStatusDto,
  MAX_STATUS_COMMENT_LENGTH,
} from './change-request-status.dto';

// Same options as the global ValidationPipe (app.setup.ts)
const check = async (plain: Record<string, unknown>) =>
  validate(plainToInstance(ChangeRequestStatusDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const failedFields = async (plain: Record<string, unknown>) =>
  (await check(plain)).map((error) => error.property);

describe('ChangeRequestStatusDto', () => {
  it.each(['EN_BUSQUEDA', 'DISPONIBLE', 'AGENDADA', 'ATENDIDA', 'CERRADA'])(
    'accepts the status %s without a comment',
    async (status) => {
      expect(await check({ status })).toHaveLength(0);
    },
  );

  it('accepts a comment of up to 500 characters', async () => {
    const errors = await check({
      status: 'ATENDIDA',
      comment: 'a'.repeat(MAX_STATUS_COMMENT_LENGTH),
    });

    expect(errors).toHaveLength(0);
  });

  it('trims the comment and treats a blank one as missing', () => {
    expect(
      plainToInstance(ChangeRequestStatusDto, {
        status: 'ATENDIDA',
        comment: '  Asistió  ',
      }).comment,
    ).toBe('Asistió');
    expect(
      plainToInstance(ChangeRequestStatusDto, {
        status: 'ATENDIDA',
        comment: '   ',
      }).comment,
    ).toBeUndefined();
  });

  it('requires the status', async () => {
    expect(await failedFields({})).toContain('status');
  });

  // The shape of a rejection is valid; the domain requires the reason (HU-16)
  it('accepts RECHAZADA with its reason in the comment', async () => {
    expect(
      await check({ status: 'RECHAZADA', comment: 'Material restringido' }),
    ).toHaveLength(0);
  });

  it('accepts a reason of up to 500 characters', async () => {
    expect(
      await check({
        status: 'RECHAZADA',
        comment: 'm'.repeat(MAX_STATUS_COMMENT_LENGTH),
      }),
    ).toHaveLength(0);
  });

  // RECIBIDA is only the initial status
  it.each(['RECIBIDA', 'ROTA', 'atendida', 'rechazada'])(
    'rejects the status %s',
    async (status) => {
      expect(await failedFields({ status })).toContain('status');
    },
  );

  it('rejects a comment that is too long', async () => {
    expect(
      await failedFields({
        status: 'ATENDIDA',
        comment: 'a'.repeat(MAX_STATUS_COMMENT_LENGTH + 1),
      }),
    ).toContain('comment');
  });

  it('rejects a comment that is not text', async () => {
    expect(await failedFields({ status: 'ATENDIDA', comment: 42 })).toContain(
      'comment',
    );
  });

  // The responsible always comes from the access token, never from the body
  it.each(['userId', 'changedBy', 'changedAt'])(
    'does not accept the field %s',
    async (field) => {
      expect(
        await failedFields({ status: 'ATENDIDA', [field]: 'x' }),
      ).toContain(field);
    },
  );
});
