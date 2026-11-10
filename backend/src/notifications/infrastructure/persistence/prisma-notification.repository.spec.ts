import type { PrismaService } from '../../../prisma/prisma.service';
import { PrismaNotificationRepository } from './prisma-notification.repository';

const NOW = new Date('2026-11-10T15:00:00.000Z');
const LEASE_UNTIL = new Date('2026-11-10T15:05:00.000Z');

const row = (id: string, attempts = 0) => ({
  id,
  recipientEmail: 'juan@example.com',
  subject: 'Su solicitud SOL-2026-00042 pasó a «Disponible»',
  body: 'Nuevo estado: Disponible',
  htmlBody: '<p>Nuevo estado: <strong>Disponible</strong></p>',
  attempts,
  request: { trackingCode: 'SOL-2026-00042' },
});

/** The e2e tests run without a database, so Prisma is simulated here. */
describe('PrismaNotificationRepository', () => {
  const build = (rows: unknown[], claimedCounts: number[] = []) => {
    const updateMany = jest.fn();
    rows.forEach((_, index) =>
      updateMany.mockResolvedValueOnce({ count: claimedCounts[index] ?? 1 }),
    );
    const prisma = {
      notificationModel: {
        findMany: jest.fn().mockResolvedValue(rows),
        updateMany,
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const repository = new PrismaNotificationRepository(
      prisma as unknown as PrismaService,
    );
    return { prisma, repository };
  };

  describe('claimDue', () => {
    it('looks for the oldest PENDIENTE emails whose time has come', async () => {
      const { prisma, repository } = build([]);

      await repository.claimDue(NOW, 20, LEASE_UNTIL);

      expect(prisma.notificationModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deliveryStatus: 'PENDIENTE', scheduledAt: { lte: NOW } },
          orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
          take: 20,
        }),
      );
    });

    it('counts the attempt and moves the time to the lease, only if nobody claimed it first', async () => {
      const { prisma, repository } = build([row('n-1', 2)]);

      await repository.claimDue(NOW, 20, LEASE_UNTIL);

      expect(prisma.notificationModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'n-1', deliveryStatus: 'PENDIENTE', attempts: 2 },
        data: { attempts: { increment: 1 }, scheduledAt: LEASE_UNTIL },
      });
    });

    it('returns the claimed emails with the attempt about to happen', async () => {
      const { repository } = build([row('n-1', 2)]);

      const claimed = await repository.claimDue(NOW, 20, LEASE_UNTIL);

      expect(claimed).toEqual([
        {
          id: 'n-1',
          trackingCode: 'SOL-2026-00042',
          recipientEmail: 'juan@example.com',
          subject: 'Su solicitud SOL-2026-00042 pasó a «Disponible»',
          text: 'Nuevo estado: Disponible',
          html: '<p>Nuevo estado: <strong>Disponible</strong></p>',
          attempts: 3,
        },
      ]);
    });

    it('skips an email that another run claimed in the meantime', async () => {
      const { repository } = build([row('n-1'), row('n-2')], [0, 1]);

      const claimed = await repository.claimDue(NOW, 20, LEASE_UNTIL);

      expect(claimed.map(({ id }) => id)).toEqual(['n-2']);
    });
  });

  it('marks a sent email ENVIADA with its date', async () => {
    const { prisma, repository } = build([]);

    await repository.markSent('n-1', NOW);

    expect(prisma.notificationModel.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { deliveryStatus: 'ENVIADA', sentAt: NOW },
    });
  });

  it('keeps a failed email pending until its next attempt, with the error', async () => {
    const { prisma, repository } = build([]);

    await repository.scheduleRetry('n-1', 'ECONNREFUSED', LEASE_UNTIL);

    expect(prisma.notificationModel.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { scheduledAt: LEASE_UNTIL, lastError: 'ECONNREFUSED' },
    });
  });

  it('marks an email FALLIDA when it has no attempts left', async () => {
    const { prisma, repository } = build([]);

    await repository.markFailed('n-1', 'ECONNREFUSED');

    expect(prisma.notificationModel.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { deliveryStatus: 'FALLIDA', lastError: 'ECONNREFUSED' },
    });
  });
});
