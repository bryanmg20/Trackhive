import { ExecutionContext } from '@nestjs/common';
import { EverythingSyncDisabledError } from '../../domain/errors/everything-sync-disabled.error';
import { InvalidAgentTokenError } from '../../domain/errors/invalid-agent-token.error';
import {
  EverythingAgentGuard,
  matchesAgentToken,
} from './everything-agent.guard';

const TOKEN = 'a'.repeat(64);

const contextFor = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

const guardWith = (agentToken: string | null) =>
  new EverythingAgentGuard({ agentToken, runTimeoutMinutes: 30 });

describe('EverythingAgentGuard', () => {
  it('deja pasar al agente con su token', () => {
    expect(
      guardWith(TOKEN).canActivate(
        contextFor({ authorization: `Bearer ${TOKEN}` }),
      ),
    ).toBe(true);
  });

  it.each([
    ['sin la cabecera Authorization', {}],
    ['con otro esquema', { authorization: `Basic ${TOKEN}` }],
    ['con un token incorrecto', { authorization: `Bearer ${'b'.repeat(64)}` }],
    ['con un token más corto', { authorization: `Bearer ${TOKEN.slice(1)}` }],
    ['con el token y algo más', { authorization: `Bearer ${TOKEN} extra` }],
    ['con el token vacío', { authorization: 'Bearer ' }],
  ])('rechaza la petición %s (401)', (_case, headers) => {
    expect(() => guardWith(TOKEN).canActivate(contextFor(headers))).toThrow(
      InvalidAgentTokenError,
    );
    expect(new InvalidAgentTokenError().code).toBe('INVALID_AGENT_TOKEN');
  });

  it('dado que EVERYTHING_AGENT_TOKEN no está configurado, no acepta nada aunque llegue un token (503)', () => {
    expect(() =>
      guardWith(null).canActivate(
        contextFor({ authorization: `Bearer ${TOKEN}` }),
      ),
    ).toThrow(EverythingSyncDisabledError);
    expect(new EverythingSyncDisabledError().code).toBe(
      'EVERYTHING_SYNC_DISABLED',
    );
  });

  describe('matchesAgentToken', () => {
    it('compara el contenido exacto, sin importar el largo de lo que llega', () => {
      expect(matchesAgentToken(TOKEN, TOKEN)).toBe(true);
      expect(matchesAgentToken(TOKEN, `${TOKEN}a`)).toBe(false);
      expect(matchesAgentToken(TOKEN, '')).toBe(false);
      expect(matchesAgentToken(TOKEN, TOKEN.toUpperCase())).toBe(false);
    });
  });
});
