import { Logger } from '@nestjs/common';
import { PurgeExpiredTokensJob } from './purge-expired-tokens.job';
import type { PurgeExpiredTokensUseCase } from '../../application/use-cases/purge-expired-tokens.use-case';

describe('PurgeExpiredTokensJob', () => {
  let execute: jest.Mock<Promise<number>, []>;
  let job: PurgeExpiredTokensJob;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    execute = jest.fn(() => Promise.resolve(4));
    job = new PurgeExpiredTokensJob({
      execute,
    } as unknown as PurgeExpiredTokensUseCase);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('purges once when the app starts', async () => {
    await job.onApplicationBootstrap();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Expired refresh tokens deleted: 4');
  });

  it('logs a failed purge instead of stopping the app', async () => {
    execute.mockRejectedValueOnce(new Error('database down'));

    await expect(job.run()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
