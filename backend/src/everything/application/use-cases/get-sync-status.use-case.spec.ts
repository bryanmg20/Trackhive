import { InMemorySyncAgentRepository } from '../../../../test/fakes/in-memory-sync-agent.repository';
import { InMemorySyncRunRepository } from '../../../../test/fakes/in-memory-sync-run.repository';
import { InMemorySyncStatusQuery } from '../../../../test/fakes/in-memory-sync-status.query';
import { SyncAgent } from '../../domain/entities/sync-agent.entity';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import type { EverythingSyncConfig } from '../dto/everything-sync-config';
import { SyncRunExpirer } from '../services/sync-run-expirer';
import { GetSyncStatusUseCase } from './get-sync-status.use-case';

const T0 = new Date('2026-11-24T15:00:00.000Z');
const later = (minutes: number): Date =>
  new Date(T0.getTime() + minutes * 60_000);
const TIMEOUT = 30;
const ENABLED: EverythingSyncConfig = {
  agentToken: 't'.repeat(64),
  runTimeoutMinutes: TIMEOUT,
};

describe('GetSyncStatusUseCase (pantalla de la sincronización, HU-138)', () => {
  let runs: InMemorySyncRunRepository;
  let agent: InMemorySyncAgentRepository;

  const status = (config: EverythingSyncConfig = ENABLED) =>
    new GetSyncStatusUseCase(
      new InMemorySyncStatusQuery(runs, agent),
      config,
      new SyncRunExpirer(runs, config),
    ).execute();

  /** A run that already ended, as the agent leaves it. */
  const finishedRun = async (
    id: string,
    startedAt: Date,
    end: (run: SyncRun) => SyncRun,
  ) => {
    const started = SyncRun.start(id, startedAt);
    await runs.create(started);
    runs.runs.set(id, end(new SyncRun({ ...started, filesCount: 130 })));
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: later(60) });
    runs = new InMemorySyncRunRepository();
    agent = new InMemorySyncAgentRepository();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sin sincronizaciones todavía: activa, sin corrida actual ni última, y el agente sin contacto', async () => {
    expect(await status()).toEqual({
      enabled: true,
      currentRun: null,
      lastRun: null,
      agentLastContactAt: null,
    });
  });

  it('muestra la última corrida que terminó bien: cuándo, cuántas carpetas y sin motivo de error', async () => {
    await finishedRun('vieja', T0, (run) => run.complete(later(1)));
    await finishedRun('ultima', later(30), (run) => run.complete(later(32)));

    const { lastRun } = await status();

    expect(lastRun).toMatchObject({
      id: 'ultima',
      status: 'OK',
      finishedAt: later(32).toISOString(),
      filesCount: 130,
      errorMessage: null,
    });
  });

  it('muestra la última corrida que terminó con error y su motivo', async () => {
    await finishedRun('fallida', T0, (run) =>
      run.fail('Everything no responde en http://127.0.0.1:8081', later(2)),
    );

    const { lastRun } = await status();

    expect(lastRun).toMatchObject({
      status: 'ERROR',
      errorMessage: 'Everything no responde en http://127.0.0.1:8081',
    });
  });

  it('dado que el agente no ha tomado la corrida pedida, muestra desde cuándo está pedida', async () => {
    await runs.create(SyncRun.request('pedida', 'admin-1', T0));

    const { currentRun } = await status();

    expect(currentRun).toMatchObject({
      id: 'pedida',
      status: 'PEDIDA',
      requestedAt: T0.toISOString(),
      startedAt: null,
      expired: false,
    });
  });

  it('muestra la corrida en curso y si el agente la abandonó (más del plazo sin páginas)', async () => {
    await runs.create(SyncRun.start('en-curso', later(50)));
    expect((await status()).currentRun).toMatchObject({
      status: 'EN_CURSO',
      expired: false,
    });

    jest.setSystemTime(later(50 + TIMEOUT + 1));
    expect((await status()).currentRun).toMatchObject({
      status: 'EN_CURSO',
      expired: true,
    });
  });

  it('muestra la última vez que el agente se comunicó', async () => {
    agent.agent = SyncAgent.contact(later(59));

    expect((await status()).agentLastContactAt).toBe(later(59).toISOString());
  });

  it('dado que la integración está desactivada, lo indica y sigue mostrando lo que hay', async () => {
    await finishedRun('vieja', T0, (run) => run.complete(later(1)));

    const result = await status({ agentToken: null, runTimeoutMinutes: 30 });

    expect(result.enabled).toBe(false);
    expect(result.lastRun?.id).toBe('vieja');
  });
});
