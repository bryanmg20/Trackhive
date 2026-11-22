import { InvalidReportPeriodError } from '../../domain/errors/invalid-report-period.error';
import type { IRequestQueryService } from '../ports/request-query.port';
import type { IAttentionTimeQuery } from '../ports/attention-time-query.port';
import { ExportReportUseCase } from './export-report.use-case';

describe('ExportReportUseCase', () => {
  const setup = () => {
    const queries = {
      findMostRequestedMaterials: jest
        .fn()
        .mockResolvedValue({ items: [], totalRequests: 0 }),
    };
    const attentionQuery = {
      summarize: jest.fn().mockResolvedValue([]),
    } satisfies IAttentionTimeQuery;
    return {
      queries,
      attentionQuery,
      useCase: new ExportReportUseCase(
        queries as unknown as IRequestQueryService,
        attentionQuery,
      ),
    };
  };
  it('queries the ranking port with the applied period and limit', async () => {
    const { queries, attentionQuery, useCase } = setup();
    const result = await useCase.execute({
      report: 'most-requested-materials',
      from: '2026-11-01',
      to: '2026-11-30',
      limit: 20,
    });
    expect(queries.findMostRequestedMaterials).toHaveBeenCalledWith({
      period: {
        start: new Date('2026-11-01T05:00:00Z'),
        end: new Date('2026-12-01T05:00:00Z'),
      },
      limit: 20,
    });
    expect(attentionQuery.summarize).not.toHaveBeenCalled();
    expect(result.fileName).toContain('top-20');
  });
  it('defaults to the top 10', async () => {
    const { queries, useCase } = setup();
    const result = await useCase.execute({
      report: 'most-requested-materials',
    });
    expect(queries.findMostRequestedMaterials).toHaveBeenCalledWith({
      period: { start: null, end: null },
      limit: 10,
    });
    expect(result.fileName).toContain('top-10');
  });
  it('queries only the attention port for attention exports', async () => {
    const { queries, attentionQuery, useCase } = setup();
    const result = await useCase.execute({
      report: 'attention-times',
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(attentionQuery.summarize).toHaveBeenCalledTimes(1);
    expect(attentionQuery.summarize).toHaveBeenCalledWith({
      start: new Date('2026-11-01T05:00:00Z'),
      end: new Date('2026-12-01T05:00:00Z'),
    });
    expect(queries.findMostRequestedMaterials).not.toHaveBeenCalled();
    expect(result.fileName).toContain(
      'tiempos-de-atencion_2026-11-01_2026-11-30',
    );
  });
  it.each(['most-requested-materials', 'attention-times'] as const)(
    'rejects an invalid period before querying %s',
    async (report) => {
      const { queries, attentionQuery, useCase } = setup();
      await expect(
        useCase.execute({ report, from: '2026-11-30', to: '2026-11-01' }),
      ).rejects.toBeInstanceOf(InvalidReportPeriodError);
      expect(queries.findMostRequestedMaterials).not.toHaveBeenCalled();
      expect(attentionQuery.summarize).not.toHaveBeenCalled();
    },
  );
  it('propagates the attention query error unchanged', async () => {
    const { attentionQuery, useCase } = setup();
    const error = new Error('db');
    attentionQuery.summarize.mockRejectedValueOnce(error);
    await expect(useCase.execute({ report: 'attention-times' })).rejects.toBe(
      error,
    );
  });
});
