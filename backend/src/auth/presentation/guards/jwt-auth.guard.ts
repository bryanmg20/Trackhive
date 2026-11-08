import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { TokenService } from '../../application/ports/token-service.port';
import { TOKEN_SERVICE } from '../../application/tokens';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from './authenticated-user';

const INVALID_TOKEN_MESSAGE = 'Token de acceso ausente, inválido o vencido';

/** Global guard: every endpoint needs a valid access token unless @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }

    const payload = await this.tokenService.verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }

    request.user = { id: payload.sub, role: payload.role };
    return true;
  }
}
