import { User } from '../entities/user.entity';

export interface IUserRepository {
  save(user: User): Promise<void>;
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}
