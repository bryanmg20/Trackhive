/** Who asks for the test email (HU-22). */
export interface SendTestEmailInput {
  /** The administrator who asks for the test, taken from the access token. */
  userId: string;
}
