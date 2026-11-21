import { InvalidReportPeriodError } from '../../domain/errors/invalid-report-period.error';
import { GetAttentionTimesUseCase } from './get-attention-times.use-case';

describe('GetAttentionTimesUseCase', () => {
  const setup = () => {
    const summarize = jest
      .fn()
      .mockResolvedValue([
        { state: 'TOTAL', requestCount: 3, averageSeconds: 86400 },
      ]);
    return { summarize, useCase: new GetAttentionTimesUseCase({ summarize }) };
  };
  it('bounds registration dates to inclusive Bogota days and preserves filters in the response', async () => {
    const { useCase, summarize } = setup();
    const result = await useCase.execute({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(summarize).toHaveBeenCalledWith({
      start: new Date('2026-11-01T05:00:00Z'),
      end: new Date('2026-12-01T05:00:00Z'),
    });
    expect(result).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
      completedRequests: 3,
      averageSeconds: 86400,
    });
  });
  it('supports open ranges and all history', async () => {
    const { useCase, summarize } = setup();
    await useCase.execute({});
    expect(summarize).toHaveBeenLastCalledWith({ start: null, end: null });
    await useCase.execute({ from: '2026-11-01' });
    expect(summarize).toHaveBeenLastCalledWith({
      start: new Date('2026-11-01T05:00:00Z'),
      end: null,
    });
  });
  it('rejects an inverted period before reading the database', async () => {
    const { useCase, summarize } = setup();
    await expect(
      useCase.execute({ from: '2026-11-30', to: '2026-11-01' }),
    ).rejects.toBeInstanceOf(InvalidReportPeriodError);
    expect(summarize).not.toHaveBeenCalled();
  });
});
