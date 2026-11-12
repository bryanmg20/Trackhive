import type { PrismaService } from '../../../prisma/prisma.service';
import {
  DATABASE_HEALTH_CHECK_TIMEOUT_MS,
  PrismaDatabaseHealthChecker,
} from './prisma-database-health-checker';

const checkerWith = (queryRaw: jest.Mock) =>
  new PrismaDatabaseHealthChecker({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);

describe('PrismaDatabaseHealthChecker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports the database as available and clears its timer', async () => {
    const checker = checkerWith(jest.fn().mockResolvedValue([{ 1: 1 }]));

    await expect(checker.isAvailable()).resolves.toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports the database as unavailable when the query fails and clears its timer', async () => {
    const checker = checkerWith(
      jest.fn().mockRejectedValue(new Error('connection refused')),
    );

    await expect(checker.isAvailable()).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports the database as unavailable when it takes longer than the timeout', async () => {
    // A query that never answers, as with a hung database
    const checker = checkerWith(
      jest.fn().mockReturnValue(new Promise(() => {})),
    );

    const result = checker.isAvailable();
    expect(jest.getTimerCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(DATABASE_HEALTH_CHECK_TIMEOUT_MS);

    await expect(result).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('still waits for a database that answers just before the timeout', async () => {
    let answer: (rows: unknown) => void = () => {};
    const checker = checkerWith(
      jest.fn().mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      ),
    );

    const result = checker.isAvailable();
    await jest.advanceTimersByTimeAsync(DATABASE_HEALTH_CHECK_TIMEOUT_MS - 1);
    answer([{ 1: 1 }]);

    await expect(result).resolves.toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
