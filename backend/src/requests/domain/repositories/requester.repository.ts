import type { Requester } from '../entities/requester.entity';

/** Saves and loads the Requester entity (HU-09, HU-10). */
export interface IRequesterRepository {
  /** The requester linked to a user account (HU-11). */
  findByUserId(userId: string): Promise<Requester | null>;

  /** The oldest requester with this email, ignoring case. */
  findByEmail(email: string): Promise<Requester | null>;

  save(requester: Requester): Promise<void>;
}
