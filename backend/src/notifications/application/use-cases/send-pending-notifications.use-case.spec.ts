import { Logger } from '@nestjs/common';
import { FakeMailSender } from '../../../../test/fakes/fake-mail-sender';
import { InMemoryNotificationRepository } from '../../../../test/fakes/in-memory-notification.repository';
import { MailDeliveryFailedError } from '../../domain/errors/mail-delivery-failed.error';
import type { NotificationDraft } from '../../domain/notification-draft';
import type { MailMessage } from '../ports/mail-sender.port';
import {
  MAX_SEND_ATTEMPTS,
  SendPendingNotificationsUseCase,
} from './send-pending-notifications.use-case';

const NOW = new Date('2026-11-10T15:00:00.000Z');
const MINUTE_MS = 60_000;
const at = (minutesFromNow: number) =>
  new Date(NOW.getTime() + minutesFromNow * MINUTE_MS);

const EMAIL: NotificationDraft = {
  recipientEmail: 'juan@example.com',
  template: 'CAMBIO_ESTADO',
  subject: 'Su solicitud SOL-2026-00042 pasó a «En búsqueda»',
  text: 'Nuevo estado: En búsqueda',
  html: '<p>Nuevo estado: <strong>En búsqueda</strong></p>',
};

/** A mail server that answers like a real one that is down. */
class DownMailSender extends FakeMailSender {
  send(message: MailMessage): Promise<void> {
    void message;
    return Promise.reject(
      new MailDeliveryFailedError('connect ECONNREFUSED 127.0.0.1:1025'),
    );
  }
}

/** Fails only on the first email, like a dropped connection. */
class FailsOnceMailSender extends FakeMailSender {
  private alreadyFailed = false;

  send(message: MailMessage): Promise<void> {
    if (!this.alreadyFailed) {
      this.alreadyFailed = true;
      return Promise.reject(new Error('timeout'));
    }
    return super.send(message);
  }
}

describe('SendPendingNotificationsUseCase', () => {
  let outbox: InMemoryNotificationRepository;
  let mailSender: FakeMailSender;
  let errorSpy: jest.SpyInstance;

  const run = (now: Date = NOW, sender: FakeMailSender = mailSender) =>
    new SendPendingNotificationsUseCase(outbox, sender).execute(now);

  beforeEach(() => {
    outbox = new InMemoryNotificationRepository();
    mailSender = new FakeMailSender();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('sends a pending email to the requester and marks it ENVIADA', async () => {
    const row = outbox.enqueue('SOL-2026-00042', EMAIL, NOW);

    const result = await run();

    expect(result).toEqual({ sent: 1, retrying: 0, failed: 0 });
    expect(mailSender.sent).toEqual([
      {
        to: 'juan@example.com',
        subject: 'Su solicitud SOL-2026-00042 pasó a «En búsqueda»',
        text: 'Nuevo estado: En búsqueda',
        html: '<p>Nuevo estado: <strong>En búsqueda</strong></p>',
      },
    ]);
    expect(row).toMatchObject({ deliveryStatus: 'ENVIADA', attempts: 1 });
    expect(row.sentAt).toBeInstanceOf(Date);
  });

  it('sends each email only once', async () => {
    outbox.enqueue('SOL-2026-00042', EMAIL, NOW);

    await run();
    await run(at(10));

    expect(mailSender.sent).toHaveLength(1);
  });

  it('does not send an email before its time', async () => {
    outbox.enqueue('SOL-2026-00042', EMAIL, at(1));

    const result = await run();

    expect(result).toEqual({ sent: 0, retrying: 0, failed: 0 });
    expect(mailSender.sent).toHaveLength(0);
  });

  describe('when the mail server fails', () => {
    it('keeps the email PENDIENTE with the error and tries again in 1 minute', async () => {
      const row = outbox.enqueue('SOL-2026-00042', EMAIL, NOW);

      const result = await run(NOW, new DownMailSender());

      expect(result).toEqual({ sent: 0, retrying: 1, failed: 0 });
      expect(row).toMatchObject({
        deliveryStatus: 'PENDIENTE',
        attempts: 1,
        lastError: 'connect ECONNREFUSED 127.0.0.1:1025',
        scheduledAt: at(1),
        sentAt: null,
      });
    });

    it('logs the failure with the tracking code and the attempt, without the recipient', async () => {
      outbox.enqueue('SOL-2026-00042', EMAIL, NOW);

      await run(NOW, new DownMailSender());

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [message] = errorSpy.mock.calls[0] as [string];
      expect(message).toContain('SOL-2026-00042');
      expect(message).toContain(`attempt 1 of ${MAX_SEND_ATTEMPTS}`);
      expect(message).toContain('ECONNREFUSED');
      expect(message).toContain(at(1).toISOString());
      // The recipient is personal data (D-23)
      expect(message).not.toContain('juan@example.com');
    });

    it('waits 1, 5, 15 and 60 minutes and then marks it FALLIDA', async () => {
      const row = outbox.enqueue('SOL-2026-00042', EMAIL, NOW);
      const down = new DownMailSender();
      const nextAttempts: Date[] = [];
      let now = NOW;

      for (let attempt = 1; attempt < MAX_SEND_ATTEMPTS; attempt++) {
        await run(now, down);
        nextAttempts.push(row.scheduledAt);
        now = row.scheduledAt;
      }
      const last = await run(now, down);

      const gapsInMinutes = nextAttempts.map(
        (date, index) =>
          (date.getTime() -
            (index === 0 ? NOW : nextAttempts[index - 1]).getTime()) /
          MINUTE_MS,
      );
      expect(gapsInMinutes).toEqual([1, 5, 15, 60]);
      expect(last).toEqual({ sent: 0, retrying: 0, failed: 1 });
      expect(row).toMatchObject({
        deliveryStatus: 'FALLIDA',
        attempts: MAX_SEND_ATTEMPTS,
      });
      expect(errorSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('No attempts left'),
      );
    });

    it('sends it on a later run once the server is back', async () => {
      const row = outbox.enqueue('SOL-2026-00042', EMAIL, NOW);
      await run(NOW, new DownMailSender());

      const result = await run(at(1));

      expect(result).toEqual({ sent: 1, retrying: 0, failed: 0 });
      expect(row).toMatchObject({ deliveryStatus: 'ENVIADA', attempts: 2 });
      expect(mailSender.sent).toHaveLength(1);
    });

    it('does not stop the other emails of the run', async () => {
      outbox.enqueue('SOL-2026-00001', EMAIL, NOW);
      outbox.enqueue(
        'SOL-2026-00002',
        { ...EMAIL, recipientEmail: 'ana@example.com' },
        NOW,
      );
      const failingOnce = new FailsOnceMailSender();

      const result = await run(NOW, failingOnce);

      expect(result).toEqual({ sent: 1, retrying: 1, failed: 0 });
      expect(failingOnce.sent.map(({ to }) => to)).toEqual(['ana@example.com']);
    });
  });

  it('sends at most 20 emails per run', async () => {
    for (let index = 0; index < 25; index++) {
      outbox.enqueue(`SOL-2026-${index}`, EMAIL, NOW);
    }

    const result = await run();

    expect(result.sent).toBe(20);
    expect(
      outbox.rows.filter((row) => row.deliveryStatus === 'PENDIENTE'),
    ).toHaveLength(5);
  });
});
