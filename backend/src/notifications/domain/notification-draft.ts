/** Kinds of email of the outbox (CHECK in the migration). HU-24 adds more. */
export const NOTIFICATION_TEMPLATES = ['CAMBIO_ESTADO'] as const;

export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];

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
