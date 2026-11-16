import { Inject, Injectable } from '@nestjs/common';
import type { SendTestEmailInput } from '../dto/send-test-email.input';
import { escapeHtml } from '../../../common/html/escape-html';
import { USER_REPOSITORY } from '../../../users/application/tokens';
import { UserNotFoundError } from '../../../users/domain/errors/user-not-found.error';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { TestEmailResponseDto } from '../dto/test-email-response.dto';
import { TestEmailResponseMapper } from '../mappers/test-email-response.mapper';
import type { IMailSender } from '../ports/mail-sender.port';
import { MAIL_SENDER } from '../tokens';

/**
 * Sends a test email so an administrator can check the mail configuration.
 * It always goes to the administrator's own email, so the endpoint cannot
 * be used to send emails to anyone else.
 */
@Injectable()
export class SendTestEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: IMailSender,
  ) {}

  async execute(input: SendTestEmailInput): Promise<TestEmailResponseDto> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const name = `${user.firstName} ${user.lastName}`;
    await this.mailSender.send({
      to: user.email,
      subject: 'Correo de prueba de Trackhive',
      text:
        `Hola, ${name}:\n\n` +
        'Este es un correo de prueba de Trackhive. Si lo recibiste, el ' +
        'envío de correos está bien configurado.',
      html:
        `<p>Hola, ${escapeHtml(name)}:</p>` +
        '<p>Este es un correo de prueba de Trackhive. Si lo recibiste, el ' +
        'envío de correos está bien configurado.</p>',
    });

    return TestEmailResponseMapper.toDto(user.email);
  }
}
