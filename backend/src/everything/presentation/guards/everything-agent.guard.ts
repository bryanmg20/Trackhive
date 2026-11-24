import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import type { EverythingSyncConfig } from '../../application/dto/everything-sync-config';
import { EVERYTHING_SYNC_CONFIG } from '../../application/tokens';
import { EverythingSyncDisabledError } from '../../domain/errors/everything-sync-disabled.error';
import { InvalidAgentTokenError } from '../../domain/errors/invalid-agent-token.error';

const BEARER = /^Bearer (\S+)$/;

/**
 * Compares the token of the agent in constant time. Both sides are hashed to
 * 32 bytes first, so neither the content nor the length of the expected
 * token leaks through how long the comparison takes.
 */
export function matchesAgentToken(expected: string, given: string): boolean {
  const digest = (value: string): Buffer =>
    createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(expected), digest(given));
}

/**
 * Guard of the ingest endpoints of the Everything agent (HU-137), apart from
 * the sign-in of the users (D-12). The agent sends
 * `Authorization: Bearer <EVERYTHING_AGENT_TOKEN>`:
 * - without EVERYTHING_AGENT_TOKEN in the backend the integration is
 *   disabled: 503 EVERYTHING_SYNC_DISABLED and nothing is accepted;
 * - without the header, with another scheme or another token: 401
 *   INVALID_AGENT_TOKEN.
 * Either way the request never reaches the controller, so nothing is saved.
 * The global filter translates both errors (D-14).
 */
@Injectable()
export class EverythingAgentGuard implements CanActivate {
  constructor(
    @Inject(EVERYTHING_SYNC_CONFIG)
    private readonly config: EverythingSyncConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.agentToken;
    if (expected === null) {
      throw new EverythingSyncDisabledError();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (!token || !matchesAgentToken(expected, token)) {
      throw new InvalidAgentTokenError();
    }
    return true;
  }
}
