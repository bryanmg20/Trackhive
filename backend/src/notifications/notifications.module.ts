import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MAIL_SENDER, NOTIFICATION_QUEUE } from './application/tokens';
import { SendPendingNotificationsUseCase } from './application/use-cases/send-pending-notifications.use-case';
import { SendTestEmailUseCase } from './application/use-cases/send-test-email.use-case';
import { SendPendingNotificationsJob } from './infrastructure/jobs/send-pending-notifications.job';
import { SmtpMailSender } from './infrastructure/mail/smtp-mail-sender';
import { PrismaNotificationQueue } from './infrastructure/persistence/prisma-notification.queue';
import { NotificationsController } from './presentation/controllers/notifications.controller';

@Module({
  imports: [UsersModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: MAIL_SENDER,
      useClass: SmtpMailSender,
    },
    {
      provide: NOTIFICATION_QUEUE,
      useClass: PrismaNotificationQueue,
    },
    SendTestEmailUseCase,
    // HU-23: the status change queues its email in the outbox, in the same
    // transaction (PrismaRequestRepository); this job sends it
    SendPendingNotificationsUseCase,
    SendPendingNotificationsJob,
  ],
  exports: [MAIL_SENDER],
})
export class NotificationsModule {}
