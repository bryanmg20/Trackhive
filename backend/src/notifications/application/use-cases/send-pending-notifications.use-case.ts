import { Inject, Injectable, Logger } from '@nestjs/common';
import { MailDeliveryFailedError } from '../../domain/errors/mail-delivery-failed.error';
import type { MailSender } from '../ports/mail-sender.port';
import type {
  NotificationRepository,
  PendingNotification,
} from '../ports/notification.repository.port';
import { MAIL_SENDER, NOTIFICATION_REPOSITORY } from '../tokens';

/** After this many failed attempts the email is FALLIDA and not retried. */
export const MAX_SEND_ATTEMPTS = 5;

const MINUTE_MS = 60_000;

// Wait after the 1st, 2nd, 3rd and 4th failed attempt: about 1 h 20 min in all
const RETRY_DELAYS_MS = [1, 5, 15, 60].map((minutes) => minutes * MINUTE_MS);

// Emails sent per run, so a long queue does not hold one run for minutes
const BATCH_SIZE = 20;

// A claimed email that is still pending after this (the app stopped while
// sending it) is claimed again. Much longer than the SMTP timeouts
const LEASE_MS = 5 * MINUTE_MS;

export interface SendPendingNotificationsResult {
  sent: number;
  // Failed now, but will be tried again
  retrying: number;
  // Failed for the last time: FALLIDA
  failed: number;
}

/**
 * Sends the pending emails of the outbox (HU-23, D-10). The status change
 * already happened and was saved; this only delivers its email. A failure is
 * logged and kept with the email, which is retried later, so the change is
 * never undone by the mail server.
 */
@Injectable()
export class SendPendingNotificationsUseCase {
  private readonly logger = new Logger(SendPendingNotificationsUseCase.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
  ) {}

  async execute(
    now: Date = new Date(),
  ): Promise<SendPendingNotificationsResult> {
    const due = await this.notifications.claimDue(
      now,
      BATCH_SIZE,
      new Date(now.getTime() + LEASE_MS),
    );

    const result: SendPendingNotificationsResult = {
      sent: 0,
      retrying: 0,
      failed: 0,
    };
    for (const notification of due) {
      try {
        await this.mailSender.send({
          to: notification.recipientEmail,
          subject: notification.subject,
          text: notification.text,
          ...(notification.html ? { html: notification.html } : {}),
        });
      } catch (error) {
        const retried = await this.registerFailure(notification, error, now);
        result[retried ? 'retrying' : 'failed'] += 1;
        continue;
      }
      await this.notifications.markSent(notification.id, new Date());
      result.sent += 1;
    }
    return result;
  }

  /** Returns whether the email will be tried again. */
  private async registerFailure(
    notification: PendingNotification,
    error: unknown,
    now: Date,
  ): Promise<boolean> {
    const reason = describe(error);
    // Never the recipient in the logs (D-23): the id and the tracking code
    // are enough to find the email in the notifications table
    const what =
      `Could not send the email ${notification.id} of request ` +
      `${notification.trackingCode} (attempt ${notification.attempts} of ` +
      `${MAX_SEND_ATTEMPTS}): ${reason}`;

    if (notification.attempts >= MAX_SEND_ATTEMPTS) {
      await this.notifications.markFailed(notification.id, reason);
      this.logger.error(`${what}. No attempts left: it is marked FALLIDA`);
      return false;
    }

    const delay = RETRY_DELAYS_MS[notification.attempts - 1];
    const retryAt = new Date(now.getTime() + delay);
    await this.notifications.scheduleRetry(notification.id, reason, retryAt);
    this.logger.error(`${what}. Next attempt at ${retryAt.toISOString()}`);
    return true;
  }
}

function describe(error: unknown): string {
  if (error instanceof MailDeliveryFailedError) {
    return error.detail ?? error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
