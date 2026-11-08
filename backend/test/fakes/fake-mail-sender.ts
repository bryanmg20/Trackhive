import type {
  MailMessage,
  MailSender,
} from '../../src/notifications/application/ports/mail-sender.port';
import { MailDeliveryFailedError } from '../../src/notifications/domain/errors/mail-delivery-failed.error';

/** Fake for unit and e2e tests (D-21): keeps the emails instead of sending them. */
export class FakeMailSender implements MailSender {
  readonly sent: MailMessage[] = [];
  /** Set to true to simulate a mail server that is down. */
  failing = false;

  send(message: MailMessage): Promise<void> {
    if (this.failing) {
      return Promise.reject(new MailDeliveryFailedError());
    }
    this.sent.push(message);
    return Promise.resolve();
  }
}
