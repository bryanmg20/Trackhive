import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../auth/presentation/decorators/roles.decorator';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import type { UserRole } from '../../domain/enums/user-role';
import type { CreateStaffUserUseCase } from '../../application/use-cases/create-staff-user.use-case';
import type { ListStaffUsersUseCase } from '../../application/use-cases/list-staff-users.use-case';
import type { UpdateStaffUserUseCase } from '../../application/use-cases/update-staff-user.use-case';
import { StaffUserController } from './staff-user.controller';

const HANDLERS = ['list', 'create', 'update'] as const;
type Handler = (typeof HANDLERS)[number];

/** The context RolesGuard sees when `role` calls `handler`. */
const contextFor = (handler: Handler, role: UserRole): ExecutionContext =>
  ({
    // The method itself, as Nest passes it to the guards
    getHandler: (): unknown =>
      Object.getOwnPropertyDescriptor(StaffUserController.prototype, handler)
        ?.value,
    getClass: () => StaffUserController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'user-1', role } }),
    }),
  }) as unknown as ExecutionContext;

describe('StaffUserController (HU-05)', () => {
  const guard = new RolesGuard(new Reflector());

  it("declares @Roles('ADMIN') for the whole controller", () => {
    expect(Reflect.getMetadata(ROLES_KEY, StaffUserController)).toEqual([
      'ADMIN',
    ]);
  });

  it.each(HANDLERS)('lets an ADMIN call %s', (handler) => {
    expect(guard.canActivate(contextFor(handler, 'ADMIN'))).toBe(true);
  });

  it.each(
    HANDLERS.flatMap((handler) =>
      (['PERSONAL', 'PUBLICO'] as const).map((role): [Handler, UserRole] => [
        handler,
        role,
      ]),
    ),
  )('rejects %s for %s with 403', (handler, role) => {
    expect(() => guard.canActivate(contextFor(handler, role))).toThrow(
      ForbiddenException,
    );
  });

  it('passes the signed-in administrator as the author of the change', async () => {
    const execute = jest.fn().mockResolvedValue({});
    const controller = new StaffUserController(
      {} as ListStaffUsersUseCase,
      {} as CreateStaffUserUseCase,
      { execute } as unknown as UpdateStaffUserUseCase,
    );

    await controller.update(
      'staff-1',
      { active: false },
      { id: 'admin-1', role: 'ADMIN' },
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff-1',
        active: false,
        changedBy: 'admin-1',
      }),
    );
  });
});
