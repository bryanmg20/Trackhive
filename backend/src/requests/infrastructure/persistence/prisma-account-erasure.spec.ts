import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaAccountErasure } from './prisma-account-erasure';
import { AccountErasureConflictError } from '../../domain/errors/account-erasure-conflict.error';
describe('PrismaAccountErasure transaction errors', () => {
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
