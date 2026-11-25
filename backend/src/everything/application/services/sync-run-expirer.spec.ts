import { Logger } from '@nestjs/common';
import { InMemorySyncRunRepository } from '../../../../test/fakes/in-memory-sync-run.repository';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { SyncRunExpirer } from './sync-run-expirer';

const T0 = new Date('2026-11-24T15:00:00.000Z');
const later = (minutes: number): Date =>
  new Date(T0.getTime() + minutes * 60_000);
const TIMEOUT = 30;

describe('SyncRunExpirer', () => {
  let runs: InMemorySyncRunRepository;
  let expirer: SyncRunExpirer;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    runs = new InMemorySyncRunRepository();
    expirer = new SyncRunExpirer(runs, {
      agentToken: 'token',
      runTimeoutMinutes: TIMEOUT,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('vence la corrida en curso que pasó el plazo sin páginas, con error', async () => {
    const run = SyncRun.start('cortada', T0);
    await runs.create(run);

    expect(expirer.isExpired(run, later(TIMEOUT + 1))).toBe(true);
    await expirer.expire(run, later(TIMEOUT + 1));

    expect(runs.runs.get('cortada')).toMatchObject({ status: 'ERROR' });
  });

  it('si otra instancia la cerró primero, o le llegó una página, no hace nada', async () => {
    const run = SyncRun.start('cortada', T0);
    await runs.create(run);
    await runs.finish(run.complete(later(5)));

    await expect(
      expirer.expire(run, later(TIMEOUT + 1)),
    ).resolves.toBeUndefined();
    expect(runs.runs.get('cortada')?.status).toBe('OK');
  });

  it('un error de la base sí se propaga', async () => {
    const run = SyncRun.start('cortada', T0);
    jest.spyOn(runs, 'finish').mockRejectedValueOnce(new Error('sin base'));

    await expect(expirer.expire(run, later(TIMEOUT + 1))).rejects.toThrow(
      'sin base',
    );
  });

  it('una corrida pedida nunca vence', () => {
    const run = SyncRun.request('pedida', 'admin-1', T0);

    expect(expirer.isExpired(run, later(10 * TIMEOUT))).toBe(false);
  });
});
