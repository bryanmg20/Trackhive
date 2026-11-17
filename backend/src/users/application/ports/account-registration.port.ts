import type { Requester } from '../../../requests/domain/entities/requester.entity';
import type { User } from '../../domain/entities/user.entity';

/** An account and its characterized requester must be created atomically. */
export interface IAccountRegistration {
  save(user: User, requester: Requester): Promise<void>;
}
