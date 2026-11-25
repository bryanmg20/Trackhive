export interface SyncAgentProps {
  // The last time the agent called Trackhive with its token
  lastContactAt: Date;
}

/**
 * The agent of the CLENA (HU-166) as Trackhive knows it (HU-138): only when
 * it last called with its token. There is a single agent, and the screen of
 * the sync shows that moment, so the administrator knows whether the PC of
 * the CLENA is on.
 */
export class SyncAgent {
  public readonly lastContactAt: Date;

  constructor(props: SyncAgentProps) {
    this.lastContactAt = props.lastContactAt;
  }

  /**
   * The agent called Trackhive now: to ask whether a run is requested, or to
   * start, feed or close one.
   */
  static contact(now: Date = new Date()): SyncAgent {
    return new SyncAgent({ lastContactAt: now });
  }
}
