import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  NotificationRepository,
  PendingNotification,
} from '../../application/ports/notification.repository.port';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimDue(
    now: Date,
    limit: number,
    leaseUntil: Date,
  ): Promise<PendingNotification[]> {
    const due = await this.prisma.notificationModel.findMany({
      where: { deliveryStatus: 'PENDIENTE', scheduledAt: { lte: now } },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        recipientEmail: true,
        subject: true,
        body: true,
        htmlBody: true,
        attempts: true,
        request: { select: { trackingCode: true } },
      },
    });

    const claimed: PendingNotification[] = [];
    for (const row of due) {
      // Optimistic lock on the attempts: if another run or instance claimed
      // it after this read, it already counted one more attempt and nothing
      // is updated here, so the email is not sent twice
      const { count } = await this.prisma.notificationModel.updateMany({
        where: {
          id: row.id,
          deliveryStatus: 'PENDIENTE',
          attempts: row.attempts,
        },
        data: { attempts: { increment: 1 }, scheduledAt: leaseUntil },
      });
      if (count === 1) {
        claimed.push({
          id: row.id,
          trackingCode: row.request.trackingCode,
          recipientEmail: row.recipientEmail,
          subject: row.subject,
          text: row.body,
          html: row.htmlBody,
          attempts: row.attempts + 1,
        });
      }
    }
    return claimed;
  }

  async markSent(id: string, sentAt: Date): Promise<void> {
    await this.prisma.notificationModel.update({
      where: { id },
      data: { deliveryStatus: 'ENVIADA', sentAt },
    });
  }

  async scheduleRetry(id: string, error: string, retryAt: Date): Promise<void> {
    await this.prisma.notificationModel.update({
      where: { id },
      data: { scheduledAt: retryAt, lastError: error },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.notificationModel.update({
      where: { id },
      data: { deliveryStatus: 'FALLIDA', lastError: error },
    });
  }
}
