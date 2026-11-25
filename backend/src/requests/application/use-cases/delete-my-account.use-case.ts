import { Inject, Injectable } from '@nestjs/common';
import type { DeleteMyAccountInput } from '../dto/delete-my-account.input';
import { ACCOUNT_ERASURE } from '../ports/account-erasure.port';
import type { IAccountErasure } from '../ports/account-erasure.port';
import { AccountDeletionNotConfirmedError } from '../../domain/errors/account-deletion-not-confirmed.error';
@Injectable()
export class DeleteMyAccountUseCase {
  constructor(
    @Inject(ACCOUNT_ERASURE) private readonly erasure: IAccountErasure,
  ) {}
  async execute(input: DeleteMyAccountInput): Promise<void> {
    if (input.confirmation !== true)
      throw new AccountDeletionNotConfirmedError();
    await this.erasure.erase(input.userId);
  }
}
