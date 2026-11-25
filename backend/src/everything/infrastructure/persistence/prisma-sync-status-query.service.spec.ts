import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { PrismaSyncStatusQueryService } from './prisma-sync-status-query.service';

const T0 = new Date('2026-11-24T15:00:00.000Z');

const row = (overrides: Record<string, unknown>) => ({
  id: 'run',
  status: 'OK',
  requestedAt: null,
  requestedById: null,
  startedAt: T0,
  lastActivityAt: T0,
  finishedAt: T0,
  filesCount: 130,
  errorMessage: null,
  ...overrides,
});

describe('PrismaSyncStatusQueryService (HU-138)', () => {
  const build = (answers: unknown[]) => {
    const prisma = {
      syncRunModel: { findFirst: jest.fn().mockReturnValue('runs') },
      syncAgentModel: { findUnique: jest.fn().mockReturnValue('agent') },
      $transaction: jest.fn().mockResolvedValue(answers),
    };
    return {
      prisma,
      query: new PrismaSyncStatusQueryService(
        prisma as unknown as PrismaService,
      ),
    };
  };

  it('lee las corridas y el agente en una sola transacción REPEATABLE READ', async () => {
    const { prisma, query } = build([null, null, null]);

    await query.read();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const [reads, options] = prisma.$transaction.mock.calls[0] as [
      unknown[],
      { isolationLevel: string },
    ];
    // One same snapshot: in READ COMMITTED each read could see a different one
    expect(reads).toHaveLength(3);
    expect(options).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(prisma.syncRunModel.findFirst).toHaveBeenCalledWith({
      where: { status: { in: ['PEDIDA', 'EN_CURSO'] } },
    });
    expect(prisma.syncRunModel.findFirst).toHaveBeenCalledWith({
      where: { status: { in: ['OK', 'ERROR'] } },
      orderBy: { startedAt: 'desc' },
    });
    expect(prisma.syncAgentModel.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('arma la foto con la corrida pedida o en curso, la última que terminó y el agente', async () => {
    const { query } = build([
      row({
        id: 'pedida',
        status: 'PEDIDA',
        requestedAt: T0,
        requestedById: 'admin-1',
        startedAt: null,
        finishedAt: null,
        filesCount: 0,
      }),
      row({ id: 'ultima' }),
      { id: 1, lastContactAt: T0 },
    ]);

    const snapshot = await query.read();

    expect(snapshot.currentRun).toMatchObject({
      id: 'pedida',
      status: 'PEDIDA',
      requestedById: 'admin-1',
    });
    expect(snapshot.lastRun).toMatchObject({ id: 'ultima', status: 'OK' });
    expect(snapshot.agent?.lastContactAt).toEqual(T0);
  });

  it('sin corridas ni contacto todavía, todo vacío', async () => {
    const { query } = build([null, null, null]);

    expect(await query.read()).toEqual({
      currentRun: null,
      lastRun: null,
      agent: null,
    });
  });
});
