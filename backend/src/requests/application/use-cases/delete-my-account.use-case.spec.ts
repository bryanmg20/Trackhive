import { DeleteMyAccountUseCase } from './delete-my-account.use-case';
import { AccountDeletionNotConfirmedError } from '../../domain/errors/account-deletion-not-confirmed.error';
describe('DeleteMyAccountUseCase', () => {
  it('requires an explicit confirmation before touching persistence', async () => {
    const erase = jest.fn();
    const useCase = new DeleteMyAccountUseCase({ erase });
    await expect(
      useCase.execute({ userId: 'own', confirmation: false }),
    ).rejects.toBeInstanceOf(AccountDeletionNotConfirmedError);
    expect(erase).not.toHaveBeenCalled();
  });
  it('erases only the session owner', async () => {
    const erase = jest.fn().mockResolvedValue(undefined);
    await new DeleteMyAccountUseCase({ erase }).execute({
      userId: 'own',
      confirmation: true,
    });
    expect(erase).toHaveBeenCalledWith('own');
  });
  it('propagates failure without claiming success', async () => {
    const error = new Error('transaction failed');
    await expect(
      new DeleteMyAccountUseCase({
        erase: jest.fn().mockRejectedValue(error),
      }).execute({ userId: 'own', confirmation: true }),
    ).rejects.toBe(error);
  });
});
