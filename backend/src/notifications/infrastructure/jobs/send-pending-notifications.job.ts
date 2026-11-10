import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SendPendingNotificationsUseCase } from '../../application/use-cases/send-pending-notifications.use-case';

export const SEND_PENDING_NOTIFICATIONS_JOB = 'send-pending-notifications';

// How often the outbox is checked: an email arrives within seconds (D-10)
export const SEND_PENDING_NOTIFICATIONS_INTERVAL_MS = 10_000;

/**
 * Sends the pending emails of the outbox every few seconds (HU-23). Like a
 * controller, it only triggers the use case.
 */
@Injectable()
export class SendPendingNotificationsJob {
  private readonly logger = new Logger(SendPendingNotificationsJob.name);
  private running = false;

  constructor(
    private readonly sendPendingNotifications: SendPendingNotificationsUseCase,
  ) {}

  @Interval(
    SEND_PENDING_NOTIFICATIONS_JOB,
    SEND_PENDING_NOTIFICATIONS_INTERVAL_MS,
  )
  async run(): Promise<void> {
    // A slow mail server can make a run last more than the interval
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const { sent, retrying, failed } =
        await this.sendPendingNotifications.execute();
      if (sent + retrying + failed > 0) {
        this.logger.log(
          `Emails to requesters: ${sent} sent, ${retrying} to retry, ${failed} failed`,
        );
      }
    } catch (error) {
      // A failed run must not stop the app; the next run tries again
      this.logger.error(
        'Could not process the pending emails',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
