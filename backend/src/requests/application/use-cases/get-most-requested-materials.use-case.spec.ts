import { InvalidReportPeriodError } from '../../domain/errors/invalid-report-period.error';
import type { IRequestQueryService } from '../ports/request-query.port';
import { GetMostRequestedMaterialsUseCase } from './get-most-requested-materials.use-case';

const material = (id: string, requestCount: number) => ({
  materialId: id,
  catalogCode: `CLENA-${id}`,
  title: `Material ${id}`,
  materialType: 'DOCUMENTO',
  requestCount,
});

describe('GetMostRequestedMaterialsUseCase', () => {
  const setup = (items: ReturnType<typeof material>[], totalRequests = 0) => {
    const findMostRequestedMaterials = jest
      .fn()
      .mockResolvedValue({ items, totalRequests });
    const queries = {
      findMostRequestedMaterials,
    } as unknown as IRequestQueryService;
    return {
      useCase: new GetMostRequestedMaterialsUseCase(queries),
      findMostRequestedMaterials,
    };
  };

  it('counts the Bogota days of the range and ranks ties together', async () => {
    const { useCase, findMostRequestedMaterials } = setup(
      [material('A', 5), material('B', 3), material('C', 3), material('D', 1)],
      9,
    );

    const result = await useCase.execute({
      from: '2026-11-01',
      to: '2026-11-30',
      limit: 4,
    });

    expect(findMostRequestedMaterials).toHaveBeenCalledWith({
      period: {
        start: new Date('2026-11-01T05:00:00Z'),
        end: new Date('2026-12-01T05:00:00Z'),
      },
      limit: 4,
    });
    expect(result.from).toBe('2026-11-01');
    expect(result.to).toBe('2026-11-30');
    expect(result.totalRequests).toBe(9);
    expect(
      result.items.map(({ rank, requestCount }) => [rank, requestCount]),
    ).toEqual([
      [1, 5],
      [2, 3],
      [2, 3],
      [4, 1],
    ]);
    expect(result.items[0]).toEqual({ rank: 1, ...material('A', 5) });
  });

  it('counts every request and the default limit when there are no filters', async () => {
    const { useCase, findMostRequestedMaterials } = setup([]);

    const result = await useCase.execute({});

    expect(findMostRequestedMaterials).toHaveBeenCalledWith({
      period: { start: null, end: null },
      limit: 10,
    });
    expect(result).toEqual({
      from: null,
      to: null,
      totalRequests: 0,
      items: [],
    });
  });

  it('rejects a start after the end without querying', async () => {
    const { useCase, findMostRequestedMaterials } = setup([]);

    await expect(
      useCase.execute({ from: '2026-12-01', to: '2026-11-01' }),
    ).rejects.toBeInstanceOf(InvalidReportPeriodError);
    expect(findMostRequestedMaterials).not.toHaveBeenCalled();
  });
});
