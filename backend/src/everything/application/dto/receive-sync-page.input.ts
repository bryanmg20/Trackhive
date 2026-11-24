/** A page the agent sends: the JSON of Everything as it came (HU-137). */
export interface ReceiveSyncPageInput {
  runId: string;
  // 1, 2, 3…; the same number again replaces the page
  pageNumber: number;
  // Not trusted: EverythingPageMapper checks its shape (HU-135)
  page: unknown;
}
