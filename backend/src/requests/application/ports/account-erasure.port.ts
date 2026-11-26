export const ACCOUNT_ERASURE = Symbol('ACCOUNT_ERASURE');
/** One atomic operation: erase identity, personal text and all sessions. */
export interface IAccountErasure {
  erase(userId: string): Promise<void>;
}
