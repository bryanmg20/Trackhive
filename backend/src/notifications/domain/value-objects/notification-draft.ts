import type { NotificationTemplate } from '../enums/notification-template';

/**
 * An email ready to be queued in the outbox (D-10). The status change saves
 * it in its own transaction (HU-23) and a scheduled job sends it later.
 */
export interface NotificationDraft {
  readonly recipientEmail: string;
  readonly template: NotificationTemplate;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}
