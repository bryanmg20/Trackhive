import type { Prisma } from '@prisma/client';
import type { PendingNotification } from '../../application/ports/notification-queue.port';
import type { NotificationDraft } from '../../domain/value-objects/notification-draft';

/** A claimed row of the outbox with the tracking code of its request. */
export interface ClaimedNotificationRow {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  htmlBody: string | null;
  attempts: number;
  request: { trackingCode: string };
}

/** Translates between the outbox table (D-10) and the notification types. */
export class PrismaNotificationMapper {
  /** A claimed row → the email to send; `attempts` already counts this one. */
  static toPending(row: ClaimedNotificationRow): PendingNotification {
    return {
      id: row.id,
      trackingCode: row.request.trackingCode,
      recipientEmail: row.recipientEmail,
      subject: row.subject,
      text: row.body,
      html: row.htmlBody,
      attempts: row.attempts + 1,
    };
  }

  /** An email to queue → a PENDIENTE row of the outbox. */
  static toPersistence(
    draft: NotificationDraft,
    ids: { id: string; requestId: string; statusHistoryId: bigint },
    scheduledAt: Date,
  ): Prisma.NotificationModelUncheckedCreateInput {
    return {
      ...ids,
      recipientEmail: draft.recipientEmail,
      template: draft.template,
      subject: draft.subject,
      body: draft.text,
      htmlBody: draft.html,
      deliveryStatus: 'PENDIENTE',
      scheduledAt,
    };
  }

  /** Claimed by this run: one more attempt and a lease until `leaseUntil`. */
  static toClaimed(
    leaseUntil: Date,
  ): Prisma.NotificationModelUpdateManyMutationInput {
    return { attempts: { increment: 1 }, scheduledAt: leaseUntil };
  }

  static toSent(sentAt: Date): Prisma.NotificationModelUpdateInput {
    return { deliveryStatus: 'ENVIADA', sentAt };
  }

  /** Failed, to be tried again at `retryAt`. */
  static toRetry(
    error: string,
    retryAt: Date,
  ): Prisma.NotificationModelUpdateInput {
    return { scheduledAt: retryAt, lastError: error };
  }

  /** Failed for the last time. */
  static toFailed(error: string): Prisma.NotificationModelUpdateInput {
    return { deliveryStatus: 'FALLIDA', lastError: error };
  }
}
