/** What one run of the outbox did (HU-23). Only the job reads it. */
export interface SendPendingNotificationsResult {
  sent: number;
  // Failed now, but will be tried again
  retrying: number;
  // Failed for the last time: FALLIDA
  failed: number;
}
