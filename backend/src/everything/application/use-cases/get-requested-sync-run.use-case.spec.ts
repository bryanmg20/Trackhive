import { InMemorySyncRunRepository } from '../../../../test/fakes/in-memory-sync-run.repository';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { GetRequestedSyncRunUseCase } from './get-requested-sync-run.use-case';

const T0 = new Date('2026-11-24T15:00:00.000Z');

describe('GetRequestedSyncRunUseCase (el agente pregunta, HU-138)', () => {
  let runs: InMemorySyncRunRepository;

  beforeEach(() => {
    runs = new InMemorySyncRunRepository();
  });

  it('sin corrida pedida, el agente no tiene nada que hacer', async () => {
    expect(await new GetRequestedSyncRunUseCase(runs).execute()).toEqual({
      requested: false,
      requestedAt: null,
    });
  });

  it('con una corrida pedida, le dice que la ejecute y desde cuándo está pedida', async () => {
    await runs.create(SyncRun.request('pedida', 'admin-1', T0));

    expect(await new GetRequestedSyncRunUseCase(runs).execute()).toEqual({
      requested: true,
      requestedAt: T0.toISOString(),
    });
  });

  it('una corrida en curso no es pedida: ya la tomó', async () => {
    await runs.create(SyncRun.request('pedida', 'admin-1', T0));
    await runs.take(runs.runs.get('pedida')!.take(T0));

    expect(
      (await new GetRequestedSyncRunUseCase(runs).execute()).requested,
    ).toBe(false);
  });
});
