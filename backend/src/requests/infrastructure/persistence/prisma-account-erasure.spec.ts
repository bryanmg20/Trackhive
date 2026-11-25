import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaAccountErasure } from './prisma-account-erasure';
import { AccountErasureConflictError } from '../../domain/errors/account-erasure-conflict.error';
import { randomUUID } from 'crypto';

describe('PrismaAccountErasure notification batches', () => {
  it.each([0, 1, 500, 501])(
    'uses bounded bulk writes for %i notifications',
    async (size) => {
      const comment = 'dato privado@example.test';
      const notifications = Array.from({ length: size }, () => ({
        id: randomUUID(),
        body: `Mensaje '${comment}'`,
        htmlBody: null,
        statusHistory: { comment },
      }));
      const executeRaw = jest
        .fn<Promise<number>, [Prisma.Sql]>()
        .mockResolvedValue(0);
      const writes = () => ({
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      });
      const tx = {
        userModel: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'own',
            role: 'PERSONAL',
            deletedAt: null,
          }),
          update: jest.fn().mockResolvedValue(undefined),
        },
        notificationModel: {
          ...writes(),
          findMany: jest.fn().mockResolvedValue(notifications),
          update: jest.fn(),
        },
        statusHistoryModel: writes(),
        requestItemModel: writes(),
        requestReferenceModel: writes(),
        materialLoanModel: writes(),
        requestModel: writes(),
        requesterModel: writes(),
        refreshTokenModel: writes(),
        $executeRaw: executeRaw,
        $queryRaw: jest.fn().mockResolvedValue([]),
      };
      const prisma = {
        $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
      };
      await new PrismaAccountErasure(prisma as unknown as PrismaService).erase(
        'own',
      );
      expect(tx.notificationModel.findMany).toHaveBeenCalledTimes(1);
      expect(tx.notificationModel.update).not.toHaveBeenCalled();
      expect(executeRaw).toHaveBeenCalledTimes(Math.ceil(size / 500));
      const statements = executeRaw.mock.calls.map(([query]) => query);
      expect(
        statements
          .flatMap((query) => query.values)
          .filter((_, index) => index % 3 === 0),
      ).toEqual(notifications.map((row) => row.id));
      for (const query of statements) {
        expect(query.sql).toContain('UPDATE "notifications"');
        expect(query.sql).not.toContain('Mensaje');
        expect(query.values.length).toBeLessThanOrEqual(1500);
        expect(
          query.values.filter((value) => typeof value === 'string').join('|'),
        ).not.toContain(comment);
      }
    },
  );
});
describe('PrismaAccountErasure transaction errors', () => {
  it.each(['40001', '40P01'])(
    'maps raw SQL transaction conflicts (%s) to the same retryable conflict',
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'raw SQL conflict',
        { code: 'P2010', clientVersion: 'test', meta: { code } },
      );
      const erasure = new PrismaAccountErasure({
        $transaction: jest.fn().mockRejectedValue(error),
      } as unknown as PrismaService);
      await expect(erasure.erase('own')).rejects.toBeInstanceOf(
        AccountErasureConflictError,
      );
    },
  );
  it('does not disguise a raw SQL syntax error as a retryable conflict', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('syntax', {
      code: 'P2010',
      clientVersion: 'test',
      meta: { code: '42601' },
    });
    const erasure = new PrismaAccountErasure({
      $transaction: jest.fn().mockRejectedValue(error),
    } as unknown as PrismaService);
    await expect(erasure.erase('own')).rejects.toBe(error);
  });
  it('maps a serialization failure to a retryable conflict', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('serialization', {
      code: 'P2034',
      clientVersion: 'test',
    });
    const transaction = jest.fn().mockRejectedValue(error);
    const erasure = new PrismaAccountErasure({
      $transaction: transaction,
    } as unknown as PrismaService);
    await expect(erasure.erase('own')).rejects.toBeInstanceOf(
      AccountErasureConflictError,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('preserves unrelated failures', async () => {
    const error = new Error('db offline');
    const erasure = new PrismaAccountErasure({
      $transaction: jest.fn().mockRejectedValue(error),
    } as unknown as PrismaService);
    await expect(erasure.erase('own')).rejects.toBe(error);
  });
});
