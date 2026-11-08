import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { UserRole } from '../../../users/domain/user-role';

const contextFor = (role?: UserRole): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => (role ? { user: { id: 'user-1', role } } : {}),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let metadata: Record<string, unknown>;
  let guard: RolesGuard;

  beforeEach(() => {
    metadata = {};
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => metadata[key]),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('lets any signed-in user through when there is no @Roles()', () => {
    expect(guard.canActivate(contextFor('PUBLICO'))).toBe(true);
  });

  it('lets a user with an allowed role through', () => {
    metadata[ROLES_KEY] = ['PERSONAL', 'ADMIN'];

    expect(guard.canActivate(contextFor('PERSONAL'))).toBe(true);
  });

  it('rejects a public user on a staff endpoint with 403', () => {
    metadata[ROLES_KEY] = ['PERSONAL', 'ADMIN'];

    expect(() => guard.canActivate(contextFor('PUBLICO'))).toThrow(
      ForbiddenException,
    );
  });

  it('skips the role check on a @Public() endpoint', () => {
    metadata[IS_PUBLIC_KEY] = true;
    metadata[ROLES_KEY] = ['ADMIN'];

    expect(guard.canActivate(contextFor())).toBe(true);
  });
});
