import { summarizeAttentionTimes } from './attention-times';

describe('summarizeAttentionTimes', () => {
  it('distinguishes an unvisited state from a true zero-duration visit', () => {
    const result = summarizeAttentionTimes([
      { state: 'TOTAL', requestCount: 2, averageSeconds: 3600 },
      { state: 'DISPONIBLE', requestCount: 2, averageSeconds: 0 },
      { state: 'EN_BUSQUEDA', requestCount: 1, averageSeconds: 1800 },
    ]);
    expect(result.completedRequests).toBe(2);
    expect(result.states.find((row) => row.state === 'EN_BUSQUEDA')).toEqual({
      state: 'EN_BUSQUEDA',
      requestCount: 1,
      averageSeconds: 1800,
    });
    expect(
      result.states.find((row) => row.state === 'DISPONIBLE')?.averageSeconds,
    ).toBe(0);
    expect(result.states.find((row) => row.state === 'AGENDADA')).toEqual({
      state: 'AGENDADA',
      requestCount: 0,
      averageSeconds: null,
    });
  });

  it('returns explicit empty samples, not zero averages', () => {
    const result = summarizeAttentionTimes([]);
    expect(result).toMatchObject({
      completedRequests: 0,
      averageSeconds: null,
    });
    expect(result.states).toHaveLength(4);
    expect(
      result.states.every(
        (row) => row.averageSeconds === null && row.requestCount === 0,
      ),
    ).toBe(true);
  });
});
