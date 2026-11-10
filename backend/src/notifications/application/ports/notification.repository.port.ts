/** A pending email of the outbox that the job claimed to send (HU-23). */
export interface PendingNotification {
  id: string;
  // Tracking code of the request, to tell in the logs which one failed
  trackingCode: string;
  recipientEmail: string;
  subject: string;
  text: string;
  html: string | null;
  // Attempts made, counting the one about to happen
  attempts: number;
}

/** The outbox of emails (D-10): the table notifications. */
export interface NotificationRepository {
  /**
   * Claims up to `limit` PENDIENTE emails whose scheduled time is `now` or
   * earlier: counts the attempt and moves their scheduled time to
   * `leaseUntil`. Another run that read them at the same time claims none
   * of them, and if the app stops while sending, they are tried again after
   * `leaseUntil`.
   */
  claimDue(
    now: Date,
    limit: number,
    leaseUntil: Date,
  ): Promise<PendingNotification[]>;

  /** The email was sent: ENVIADA. */
  markSent(id: string, sentAt: Date): Promise<void>;

  /** The attempt failed: stays PENDIENTE until `retryAt`, with the error. */
  scheduleRetry(id: string, error: string, retryAt: Date): Promise<void>;

  /** The last attempt failed: FALLIDA, with the error. It is not retried. */
  markFailed(id: string, error: string): Promise<void>;
}
