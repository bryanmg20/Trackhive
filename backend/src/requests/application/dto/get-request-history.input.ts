import type { HistoryViewer } from '../../domain/policies/request-history-access';

/** The request whose history is opened, and who opens it (HU-17). */
export interface GetRequestHistoryInput {
  requestId: string;
  // The user of the access token, never a value of the query (D-12)
  viewer: HistoryViewer;
}
