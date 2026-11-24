/**
 * Configuration of the Everything sync (HU-137), read from the environment
 * when the backend starts.
 */
export interface EverythingSyncConfig {
  // EVERYTHING_AGENT_TOKEN. null: not set, the integration is disabled and
  // the ingest endpoints answer 503
  agentToken: string | null;
  // EVERYTHING_RUN_TIMEOUT_MINUTES: a run without pages for longer expires
  runTimeoutMinutes: number;
}
