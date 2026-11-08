import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import type {
  TokenPayload,
  TokenService,
} from '../../application/ports/token-service.port';

const contextFor = (request: Record<string, unknown>): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let isPublic: boolean;
  let verifyAccessToken: jest.Mock<Promise<TokenPayload | null>, [string]>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    isPublic = false;
    const reflector = {
      getAllAndOverride: jest.fn(() => isPublic),
    } as unknown as Reflector;
    verifyAccessToken = jest.fn((token: string) =>
      Promise.resolve(
        token === 'valid' ? { sub: 'user-1', role: 'PUBLICO' as const } : null,
      ),
    );
    const tokenService = { verifyAccessToken } as unknown as TokenService;
    guard = new JwtAuthGuard(reflector, tokenService);
  });

  it('lets a @Public() endpoint through without a token', async () => {
    isPublic = true;

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('puts the user from a valid token on the request', async () => {
    const request = { headers: { authorization: 'Bearer valid' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user', { id: 'user-1', role: 'PUBLICO' });
  });

  it.each([
    ['no Authorization header', {}],
    ['another scheme', { authorization: 'Basic valid' }],
    ['an invalid or expired token', { authorization: 'Bearer expired' }],
  ])('rejects %s with 401', async (_case, headers) => {
    await expect(guard.canActivate(contextFor({ headers }))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
