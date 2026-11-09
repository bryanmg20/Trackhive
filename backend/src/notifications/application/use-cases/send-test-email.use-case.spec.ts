import { SendTestEmailUseCase } from './send-test-email.use-case';
import { FakeMailSender } from '../../../../test/fakes/fake-mail-sender';
import { InMemoryUserRepository } from '../../../../test/fakes/in-memory-user.repository';
import { User } from '../../../users/domain/entities/user.entity';
import { UserNotFoundError } from '../../../users/domain/errors/user-not-found.error';
import { MailDeliveryFailedError } from '../../domain/errors/mail-delivery-failed.error';

describe('SendTestEmailUseCase', () => {
  let users: InMemoryUserRepository;
  let mailSender: FakeMailSender;
  let useCase: SendTestEmailUseCase;

  const saveAdmin = (
    firstName = 'Admin',
    lastName = 'Demo',
    middleName: string | null = null,
  ): Promise<void> =>
    users.save(
      new User({
        id: 'admin-1',
        firstName,
        middleName,
        lastName,
        email: 'admin@example.com',
        passwordHash: 'hashed',
        role: 'ADMIN',
        active: true,
      }),
    );

  beforeEach(() => {
    users = new InMemoryUserRepository();
    mailSender = new FakeMailSender();
    useCase = new SendTestEmailUseCase(users, mailSender);
  });

  it('sends the test email to the email of the administrator who asks', async () => {
    await saveAdmin();

    const response = await useCase.execute({ userId: 'admin-1' });

    expect(response).toEqual({ sentTo: 'admin@example.com' });
    expect(mailSender.sent).toEqual([
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'Correo de prueba de Trackhive',
      }),
    ]);
    expect(mailSender.sent[0].text).toContain('Hola, Admin Demo');
  });

  it('greets with the first name and the first last name only', async () => {
    await saveAdmin('Ana', 'Pérez', 'María');

    await useCase.execute({ userId: 'admin-1' });

    expect(mailSender.sent[0].text).toContain('Hola, Ana Pérez:');
    expect(mailSender.sent[0].text).not.toContain('María');
  });

  it('escapes the name in the HTML version of the email', async () => {
    await saveAdmin('Ana', '<b>Pérez</b>');

    await useCase.execute({ userId: 'admin-1' });

    expect(mailSender.sent[0].html).toContain('Ana &lt;b&gt;Pérez&lt;/b&gt;');
    expect(mailSender.sent[0].html).not.toContain('<b>');
  });

  it('fails if the user of the token no longer exists', async () => {
    await expect(useCase.execute({ userId: 'deleted' })).rejects.toThrow(
      UserNotFoundError,
    );
    expect(mailSender.sent).toHaveLength(0);
  });

  it('lets a mail server failure reach the caller', async () => {
    await saveAdmin();
    mailSender.failing = true;

    await expect(useCase.execute({ userId: 'admin-1' })).rejects.toThrow(
      MailDeliveryFailedError,
    );
  });
});
