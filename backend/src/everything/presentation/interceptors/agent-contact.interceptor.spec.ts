import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { InMemorySyncAgentRepository } from '../../../../test/fakes/in-memory-sync-agent.repository';
import { RecordAgentContactUseCase } from '../../application/use-cases/record-agent-contact.use-case';
import { AgentContactInterceptor } from './agent-contact.interceptor';

const NOW = new Date('2026-11-24T15:00:00.000Z');
const context = {} as ExecutionContext;

describe('AgentContactInterceptor (HU-138)', () => {
  let agent: InMemorySyncAgentRepository;
  let interceptor: AgentContactInterceptor;
  let handle: jest.Mock;
  let handler: CallHandler;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    agent = new InMemorySyncAgentRepository();
    interceptor = new AgentContactInterceptor(
      new RecordAgentContactUseCase(agent),
    );
    handle = jest.fn(() => of('respuesta del endpoint'));
    handler = { handle };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('registra el contacto del agente antes de atender la llamada', async () => {
    const answer = await lastValueFrom(
      await interceptor.intercept(context, handler),
    );

    expect(answer).toBe('respuesta del endpoint');
    expect(agent.agent?.lastContactAt).toEqual(NOW);
  });

  it('si no puede registrarlo, lo deja en el log y la llamada sigue: la sincronización no se detiene', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    agent.failSaving = new Error('se cayó la base');

    const answer = await lastValueFrom(
      await interceptor.intercept(context, handler),
    );

    expect(answer).toBe('respuesta del endpoint');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('se cayó la base'),
    );
  });
});
