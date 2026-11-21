/** States with a measurable residence before the request is attended. */
export const ATTENTION_TIME_STATES = [
  'RECIBIDA',
  'EN_BUSQUEDA',
  'DISPONIBLE',
  'AGENDADA',
] as const;
export type AttentionTimeState = (typeof ATTENTION_TIME_STATES)[number];

/** One aggregate per state, counting requests, not individual visits. */
export interface AttentionTimeAggregate {
  state: AttentionTimeState | 'TOTAL';
  requestCount: number;
  averageSeconds: number | null;
}

export function summarizeAttentionTimes(
  rows: readonly AttentionTimeAggregate[],
) {
  const total = rows.find((row) => row.state === 'TOTAL');
  return {
    completedRequests: total?.requestCount ?? 0,
    averageSeconds: total?.averageSeconds ?? null,
    states: ATTENTION_TIME_STATES.map((state) => {
      const row = rows.find((row) => row.state === state);
      return {
        state,
        requestCount: row?.requestCount ?? 0,
        // No observation is different from a real instantaneous transition.
        averageSeconds: row?.averageSeconds ?? null,
      };
    }),
  };
}
