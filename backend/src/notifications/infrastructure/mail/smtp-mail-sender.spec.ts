import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { SmtpMailSender } from './smtp-mail-sender';
import { MailDeliveryFailedError } from '../../domain/errors/mail-delivery-failed.error';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const createTransportMock = createTransport as jest.Mock;

const MESSAGE = {
  to: 'admin@example.com',
  subject: 'Asunto',
  text: 'Texto',
};

const MAILPIT_CONFIG = {
  SMTP_HOST: 'mailpit',
  SMTP_PORT: '1025',
  SMTP_FROM: 'Trackhive <no-reply@example.com>',
};

describe('SmtpMailSender', () => {
  let sendMail: jest.Mock;
  let errorSpy: jest.SpyInstance;

  const buildSender = (config: Record<string, string>): SmtpMailSender =>
    new SmtpMailSender(new ConfigService(config));

  beforeEach(() => {
    sendMail = jest.fn(() => Promise.resolve({ messageId: 'id-1' }));
    createTransportMock.mockReset();
    createTransportMock.mockReturnValue({ sendMail });
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('connects with the SMTP_* variables and sends from SMTP_FROM', async () => {
    await buildSender(MAILPIT_CONFIG).send(MESSAGE);

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'mailpit', port: 1025, secure: false }),
    );
    const [options] = createTransportMock.mock.calls[0] as [object];
    expect(options).not.toHaveProperty('auth');
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Trackhive <no-reply@example.com>',
      ...MESSAGE,
    });
  });

  it('logs in when SMTP_USER is set and uses TLS on port 465', async () => {
    await buildSender({
      ...MAILPIT_CONFIG,
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_USER: 'clena',
      SMTP_PASSWORD: 'secreto',
    }).send(MESSAGE);

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 465,
        secure: true,
        auth: { user: 'clena', pass: 'secreto' },
      }),
    );
  });

  it('creates the connection once and reuses it', async () => {
    const sender = buildSender(MAILPIT_CONFIG);

    await sender.send(MESSAGE);
    await sender.send(MESSAGE);

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('turns a mail server failure into MailDeliveryFailedError', async () => {
    sendMail.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    await expect(buildSender(MAILPIT_CONFIG).send(MESSAGE)).rejects.toThrow(
      MailDeliveryFailedError,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED'),
    );
  });

  it('fails without sending when a required variable is missing', async () => {
    await expect(
      buildSender({ SMTP_PORT: '1025', SMTP_FROM: 'x@example.com' }).send(
        MESSAGE,
      ),
    ).rejects.toThrow(MailDeliveryFailedError);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
