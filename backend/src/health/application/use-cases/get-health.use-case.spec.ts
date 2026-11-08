import { GetHealthUseCase } from './get-health.use-case';

describe('GetHealthUseCase', () => {
  it('reports the API and database as healthy', async () => {
    const useCase = new GetHealthUseCase({
      isAvailable: jest.fn().mockResolvedValue(true),
    });

    await expect(useCase.execute()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('reports the database as down when it does not respond', async () => {
    const useCase = new GetHealthUseCase({
      isAvailable: jest.fn().mockResolvedValue(false),
    });

    await expect(useCase.execute()).resolves.toEqual({
      status: 'degraded',
      database: 'down',
    });
  });
});
