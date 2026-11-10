import type {
  NotificationRepository,
  PendingNotification,
} from '../../src/notifications/application/ports/notification.repository.port';
import type { NotificationDraft } from '../../src/notifications/domain/notification-draft';

export interface StoredNotification {
  id: string;
  trackingCode: string;
  recipientEmail: string;
  subject: string;
  text: string;
  html: string | null;
  deliveryStatus: 'PENDIENTE' | 'ENVIADA' | 'FALLIDA';
  attempts: number;
  lastError: string | null;
  scheduledAt: Date;
  sentAt: Date | null;
}

/** Fake of the outbox (D-21): the notifications table in memory. */
export class InMemoryNotificationRepository implements NotificationRepository {
  readonly rows: StoredNotification[] = [];
  private nextId = 1;

  /** What PrismaRequestRepository does in the status change transaction. */
  enqueue(
    trackingCode: string,
    draft: NotificationDraft,
    scheduledAt: Date = new Date(),
  ): StoredNotification {
    const row: StoredNotification = {
      id: `notification-${this.nextId++}`,
      trackingCode,
      recipientEmail: draft.recipientEmail,
      subject: draft.subject,
      text: draft.text,
      html: draft.html,
      deliveryStatus: 'PENDIENTE',
      attempts: 0,
      lastError: null,
      scheduledAt,
      sentAt: null,
    };
    this.rows.push(row);
    return row;
  }

  claimDue(
    now: Date,
    limit: number,
    leaseUntil: Date,
  ): Promise<PendingNotification[]> {
    const due = this.rows
      .filter(
        (row) =>
          row.deliveryStatus === 'PENDIENTE' &&
          row.scheduledAt.getTime() <= now.getTime(),
      )
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .slice(0, limit);

    return Promise.resolve(
      due.map((row) => {
        row.attempts += 1;
        row.scheduledAt = leaseUntil;
        return {
          id: row.id,
          trackingCode: row.trackingCode,
          recipientEmail: row.recipientEmail,
          subject: row.subject,
          text: row.text,
          html: row.html,
          attempts: row.attempts,
        };
      }),
    );
  }

  markSent(id: string, sentAt: Date): Promise<void> {
    Object.assign(this.find(id), { deliveryStatus: 'ENVIADA', sentAt });
    return Promise.resolve();
  }

  scheduleRetry(id: string, error: string, retryAt: Date): Promise<void> {
    Object.assign(this.find(id), { scheduledAt: retryAt, lastError: error });
    return Promise.resolve();
  }

  markFailed(id: string, error: string): Promise<void> {
    Object.assign(this.find(id), {
      deliveryStatus: 'FALLIDA',
      lastError: error,
    });
    return Promise.resolve();
  }

  private find(id: string): StoredNotification {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) {
      throw new Error(`Notification ${id} not found`);
    }
    return row;
  }
}
