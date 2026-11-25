import { Logger } from '@nestjs/common';
import { InMemorySyncRunRepository } from '../../../../test/fakes/in-memory-sync-run.repository';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { EverythingSyncDisabledError } from '../../domain/errors/everything-sync-disabled.error';
import { SyncRunAlreadyRequestedError } from '../../domain/errors/sync-run-already-requested.error';
import { SyncRunAlreadyRunningError } from '../../domain/errors/sync-run-already-running.error';
import type { EverythingSyncConfig } from '../dto/everything-sync-config';
import { SyncRunExpirer } from '../services/sync-run-expirer';
import { RequestSyncRunUseCase } from './request-sync-run.use-case';

const T0 = new Date('2026-11-24T15:00:00.000Z');
const later = (minutes: number): Date =>
  new Date(T0.getTime() + minutes * 60_000);
const TIMEOUT = 30;
const ADMIN_ID = 'admin-1';
const ENABLED: EverythingSyncConfig = {
  agentToken: 't'.repeat(64),
  runTimeoutMinutes: TIMEOUT,
};

describe('RequestSyncRunUseCase («Sincronizar ahora», HU-138)', () => {
  let runs: InMemorySyncRunRepository;

  const useCase = (config: EverythingSyncConfig = ENABLED) =>
    new RequestSyncRunUseCase(runs, config, new SyncRunExpirer(runs, config));

  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    runs = new InMemorySyncRunRepository();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('deja una corrida PEDIDA, esperando al agente, con quién y cuándo la pidió', async () => {
    const run = await useCase().execute({ userId: ADMIN_ID });

    expect(run).toMatchObject({
      status: 'PEDIDA',
      requestedAt: T0.toISOString(),
      startedAt: null,
      finishedAt: null,
      filesCount: 0,
      errorMessage: null,
    });
    expect(runs.runs.get(run.id)).toMatchObject({
      status: 'PEDIDA',
      requestedById: ADMIN_ID,
    });
  });

  it('dado que ya hay una corrida pedida, no pide otra y avisa (409 SYNC_RUN_ALREADY_REQUESTED)', async () => {
    await useCase().execute({ userId: ADMIN_ID });
    jest.setSystemTime(later(2));

    await expect(useCase().execute({ userId: 'admin-2' })).rejects.toThrow(
      SyncRunAlreadyRequestedError,
    );
    expect(runs.runs.size).toBe(1);
    expect(new SyncRunAlreadyRequestedError().code).toBe(
      'SYNC_RUN_ALREADY_REQUESTED',
    );
  });

  it('dado que hay una corrida en curso, no pide otra y avisa (409 SYNC_RUN_ALREADY_RUNNING)', async () => {
    await runs.create(SyncRun.start('diaria', later(-5)));

    await expect(useCase().execute({ userId: ADMIN_ID })).rejects.toThrow(
      SyncRunAlreadyRunningError,
    );
    expect(runs.runs.size).toBe(1);
  });

  it('una corrida en curso que el agente abandonó termina con error y deja pedir la nueva', async () => {
    await runs.create(SyncRun.start('cortada', later(-(TIMEOUT + 5))));

    const run = await useCase().execute({ userId: ADMIN_ID });

    expect(run.status).toBe('PEDIDA');
    expect(runs.runs.get('cortada')).toMatchObject({ status: 'ERROR' });
    expect(runs.runs.get('cortada')?.errorMessage).toContain('venció');
  });

  it('dado que la integración está desactivada (sin EVERYTHING_AGENT_TOKEN), responde 503 y no pide nada', async () => {
    await expect(
      useCase({ agentToken: null, runTimeoutMinutes: TIMEOUT }).execute({
        userId: ADMIN_ID,
      }),
    ).rejects.toThrow(EverythingSyncDisabledError);
    expect(runs.runs.size).toBe(0);
  });

  it('si otro administrador la pidió en el mismo instante, el índice decide y avisa que ya está pedida', async () => {
    // Both read «nothing open»; the other request is saved first. Inside,
    // runs.create is the real one again: the spy only replaces one call
    jest.spyOn(runs, 'create').mockImplementationOnce(async (run: SyncRun) => {
      await runs.create(SyncRun.request('la-otra', 'admin-2', T0));
      return runs.create(run);
    });

    await expect(useCase().execute({ userId: ADMIN_ID })).rejects.toThrow(
      SyncRunAlreadyRequestedError,
    );
    expect([...runs.runs.keys()]).toEqual(['la-otra']);
  });

  it('si el agente inició su corrida en el mismo instante, avisa que hay una en curso', async () => {
    jest.spyOn(runs, 'create').mockImplementationOnce(async (run: SyncRun) => {
      await runs.create(SyncRun.start('diaria', T0));
      return runs.create(run);
    });

    await expect(useCase().execute({ userId: ADMIN_ID })).rejects.toThrow(
      SyncRunAlreadyRunningError,
    );
  });
});
