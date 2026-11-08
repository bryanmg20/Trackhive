import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MAIL_SENDER } from './application/tokens';
import { SendTestEmailUseCase } from './application/use-cases/send-test-email.use-case';
import { SmtpMailSender } from './infrastructure/mail/smtp-mail-sender';
import { NotificationsController } from './presentation/controllers/notifications.controller';

@Module({
  imports: [UsersModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: MAIL_SENDER,
      useClass: SmtpMailSender,
    },
    SendTestEmailUseCase,
  ],
  // HU-23 sends the status change emails through the same port
  exports: [MAIL_SENDER],
})
export class NotificationsModule {}
