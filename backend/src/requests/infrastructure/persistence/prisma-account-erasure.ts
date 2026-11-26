import { Injectable } from '@nestjs/common';
import { PrismaAccountErasureMapper as Erasure } from '../mappers/prisma-account-erasure.mapper';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserNotFoundError } from '../../../users/domain/errors/user-not-found.error';
import type { IAccountErasure } from '../../application/ports/account-erasure.port';
import { assertCanEraseAccount } from '../../domain/policies/account-erasure';
import { AccountErasureConflictError } from '../../domain/errors/account-erasure-conflict.error';
const NOTIFICATION_BATCH_SIZE = 500;
@Injectable()
export class PrismaAccountErasure implements IAccountErasure {
  constructor(private readonly prisma: PrismaService) {}
  async erase(userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const user = await tx.userModel.findUnique({ where: { id: userId } });
          if (!user || user.deletedAt) throw new UserNotFoundError();
          const activeAdmins =
            user.role === 'ADMIN'
              ? await tx.userModel.count({
                  where: { role: 'ADMIN', active: true, deletedAt: null },
                })
              : 0;
          assertCanEraseAccount(user.role, activeAdmins);
          const now = new Date();
          const ownRequest = { requester: { userId } };
          const thirdPartyNotifications = await tx.notificationModel.findMany({
            where: {
              statusHistory: { userId, comment: { not: null } },
              NOT: { request: ownRequest },
            },
            select: {
              id: true,
              body: true,
              htmlBody: true,
              statusHistory: { select: { comment: true } },
            },
          });
          // One parameterized UPDATE per batch, not one round trip per email.
          // Explicit text casts also support a batch whose html bodies are all NULL.
          for (
            let offset = 0;
            offset < thirdPartyNotifications.length;
            offset += NOTIFICATION_BATCH_SIZE
          ) {
            const values = thirdPartyNotifications
              .slice(offset, offset + NOTIFICATION_BATCH_SIZE)
              .flatMap((notification) => {
                const comment = notification.statusHistory?.comment;
                if (!comment || !comment.trim()) return [];
                const redacted = Erasure.notification(notification, comment);
                return [
                  Prisma.sql`(${notification.id}::uuid, ${redacted.body}::text, ${redacted.htmlBody}::text)`,
                ];
              });
            if (values.length > 0) {
              await tx.$executeRaw(Prisma.sql`
                UPDATE "notifications" AS n
                SET "body" = v.body, "html_body" = v.html_body
                FROM (VALUES ${Prisma.join(values)}) AS v(id, body, html_body)
                WHERE n.id = v.id
              `);
            }
          }
          // The trigger permits only clearing comments in this erasure scope.
          await tx.$queryRaw`SELECT set_config('trackhive.erasing_user', ${userId}, true)`;
          await tx.statusHistoryModel.updateMany({
            where: { OR: [{ request: ownRequest }, { userId }] },
            data: Erasure.history(),
          });
          await tx.notificationModel.deleteMany({
            where: { request: ownRequest },
          });
          await tx.requestItemModel.updateMany({
            where: { request: ownRequest },
            data: Erasure.item(),
          });
          await tx.requestReferenceModel.updateMany({
            where: { request: ownRequest, kind: 'TEXTO_LIBRE' },
            data: Erasure.textReference(),
          });
          await tx.requestReferenceModel.updateMany({
            where: { request: ownRequest, kind: 'PROTOCOLO_NOTARIAL' },
            data: Erasure.notarialReference(),
          });
          await tx.materialLoanModel.updateMany({
            where: { appointment: { requester: { userId } } },
            data: Erasure.loan(),
          });
          await tx.requestModel.updateMany({
            where: ownRequest,
            data: Erasure.request(),
          });
          await tx.requestModel.updateMany({
            where: { ...ownRequest, status: 'RECHAZADA' },
            data: Erasure.rejection(),
          });
          await tx.requesterModel.updateMany({
            where: { userId },
            data: Erasure.requester(now),
          });
          await tx.refreshTokenModel.deleteMany({ where: { userId } });
          await tx.userModel.update({
            where: { id: userId },
            data: Erasure.user(now),
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' ||
          (error.code === 'P2010' &&
            (error.meta?.code === '40001' || error.meta?.code === '40P01')))
      ) {
        throw new AccountErasureConflictError();
      }
      throw error;
    }
  }
}
