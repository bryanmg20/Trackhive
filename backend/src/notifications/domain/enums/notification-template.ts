/** Kinds of email of the outbox (CHECK in the migration). HU-24 adds more. */
export const NOTIFICATION_TEMPLATES = ['CAMBIO_ESTADO'] as const;

export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];
