/**
 * The agent of the CLENA (HU-166) as Trackhive knows it (HU-138): only when
 * it last called with its token. The screen of the sync shows it, so the
 * administrator knows whether the PC of the CLENA is on. There is no entity
 * of the agent: a single row, sync_agent, keeps that moment.
 */
export interface ISyncAgentRepository {
  /** The agent called Trackhive at `at`. */
  recordContact(at: Date): Promise<void>;

  /** When the agent last called Trackhive; null if it never did. */
  findLastContact(): Promise<Date | null>;
}
