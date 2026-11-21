import { ExportReportUseCase } from './export-report.use-case';
import type { GetMostRequestedMaterialsUseCase } from './get-most-requested-materials.use-case';
import type { GetAttentionTimesUseCase } from './get-attention-times.use-case';

describe('ExportReportUseCase', () => {
  const setup = () => {
    const ranking = {
      execute: jest.fn().mockResolvedValue({
        from: '2026-11-01',
        to: null,
        totalRequests: 0,
        items: [],
      }),
    };
    const attention = {
      execute: jest.fn().mockResolvedValue({
        from: '2026-11-01',
        to: null,
        completedRequests: 0,
        averageSeconds: null,
        states: [],
      }),
    };
    return {
      ranking,
      attention,
      useCase: new ExportReportUseCase(
        ranking as unknown as GetMostRequestedMaterialsUseCase,
        attention as unknown as GetAttentionTimesUseCase,
      ),
    };
  };
  it('reuses the ranking use case with the same dates and limit', async () => {
    const { ranking, attention, useCase } = setup();
    const result = await useCase.execute({
      report: 'most-requested-materials',
      from: '2026-11-01',
      limit: 20,
    });
    expect(ranking.execute).toHaveBeenCalledWith({
      from: '2026-11-01',
      to: undefined,
      limit: 20,
    });
    expect(attention.execute).not.toHaveBeenCalled();
    expect(result.fileName).toContain('top-20');
  });
  it('retains the default top 10 and delegates attention dates unchanged', async () => {
    const { ranking, attention, useCase } = setup();
    await useCase.execute({ report: 'most-requested-materials' });
    expect(ranking.execute).toHaveBeenCalledWith({
      from: undefined,
      to: undefined,
      limit: 10,
    });
    await useCase.execute({
      report: 'attention-times',
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(attention.execute).toHaveBeenCalledWith({
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });
  it('does not create a file when report validation or the database fails', async () => {
    const { attention, useCase } = setup();
    attention.execute.mockRejectedValueOnce(new Error('Invalid period'));
    await expect(
      useCase.execute({ report: 'attention-times' }),
    ).rejects.toThrow('Invalid period');
  });
});
