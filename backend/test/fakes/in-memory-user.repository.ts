import { User } from '../../src/users/domain/entities/user.entity';
import type {
  IUserRepository,
  UserSearchCriteria,
  UserSearchResult,
} from '../../src/users/domain/repositories/user.repository';
import type { UserRole } from '../../src/users/domain/enums/user-role';

/** Fake for unit and e2e tests (D-21). */
export class InMemoryUserRepository implements IUserRepository {
  // A Map keeps the insertion order, which stands for the creation date
  private readonly users = new Map<string, User>();

  save(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  findAll(): Promise<User[]> {
    return Promise.resolve([...this.users.values()]);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === email,
    );
    return Promise.resolve(user ?? null);
  }

  findFirstByRole(role: UserRole): Promise<User | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.role === role,
    );
    return Promise.resolve(user ?? null);
  }

  /** Same rules as PrismaUserRepository.search() (HU-05). */
  search(criteria: UserSearchCriteria): Promise<UserSearchResult> {
    const words = criteria.q?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
    const created = [...this.users.keys()];

    const matches = [...this.users.values()].filter(
      (user) =>
        criteria.roles.includes(user.role) &&
        (criteria.active === undefined || user.active === criteria.active) &&
        words.every((word) =>
          [
            user.firstName,
            user.middleName,
            user.lastName,
            user.secondLastName,
            user.email,
          ].some((field) => field?.toLowerCase().includes(word)),
        ),
    );

    const value = (user: User): string | number =>
      criteria.sort === 'createdAt'
        ? created.indexOf(user.id)
        : user[criteria.sort];
    const direction = criteria.order === 'asc' ? 1 : -1;
    matches.sort((a, b) => {
      const [left, right] = [value(a), value(b)];
      if (left === right) return a.id.localeCompare(b.id);
      return (left < right ? -1 : 1) * direction;
    });

    const start = (criteria.page - 1) * criteria.limit;
    return Promise.resolve({
      items: matches.slice(start, start + criteria.limit),
      total: matches.length,
    });
  }
}
