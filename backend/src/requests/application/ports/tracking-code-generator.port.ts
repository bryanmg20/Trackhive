/** Hands out the tracking code of a new request (RN-01), never repeated. */
export interface ITrackingCodeGenerator {
  next(): Promise<string>;
}
