import { InvalidSyncRunStatusError } from '../errors/invalid-sync-run-status.error';
import { SyncRunExpiredError } from '../errors/sync-run-expired.error';
import { SyncRunNotRunningError } from '../errors/sync-run-not-running.error';
import type { SyncRunStatus } from '../enums/sync-run-status';
import { MAX_SYNC_ERROR_LENGTH, SyncRun } from './sync-run.entity';

const T0 = new Date('2026-11-23T11:00:00.000Z');
const minutesAfter = (minutes: number, from: Date = T0): Date =>
  new Date(from.getTime() + minutes * 60_000);
const TIMEOUT = 30;

describe('SyncRun', () => {
  describe('el inicio', () => {
    it('empieza EN_CURSO, con la última actividad en su inicio y sin fin', () => {
      const run = SyncRun.start('run-1', T0);

      expect(run).toMatchObject({
        id: 'run-1',
        status: 'EN_CURSO',
        startedAt: T0,
        lastActivityAt: T0,
        finishedAt: null,
        filesCount: 0,
        errorMessage: null,
      });
      expect(run.isRunning).toBe(true);
    });

    it('rechaza un estado que no es EN_CURSO, OK ni ERROR', () => {
      expect(
        () =>
          new SyncRun({
            ...SyncRun.start('run-1', T0),
            status: 'PAUSADA' as SyncRunStatus,
          }),
      ).toThrow(InvalidSyncRunStatusError);
    });
  });

  describe('el vencimiento', () => {
    it('no vence mientras recibe páginas dentro del plazo', () => {
      const run = SyncRun.start('run-1', T0).recordActivity(minutesAfter(25));

      expect(run.isExpired(TIMEOUT, minutesAfter(50))).toBe(false);
      expect(() => run.assertOpen(TIMEOUT, minutesAfter(50))).not.toThrow();
    });

    it('vence cuando lleva más del plazo sin páginas', () => {
      const run = SyncRun.start('run-1', T0);

      expect(run.isExpired(TIMEOUT, minutesAfter(30))).toBe(false);
      expect(run.isExpired(TIMEOUT, minutesAfter(31))).toBe(true);
      expect(() => run.assertOpen(TIMEOUT, minutesAfter(31))).toThrow(
        SyncRunExpiredError,
      );
    });

    it('una corrida que ya terminó no vence ni acepta páginas', () => {
      const run = SyncRun.start('run-1', T0).complete(minutesAfter(1));

      expect(run.isExpired(TIMEOUT, minutesAfter(120))).toBe(false);
      expect(() => run.assertOpen(TIMEOUT, minutesAfter(2))).toThrow(
        SyncRunNotRunningError,
      );
      expect(() => run.recordActivity(minutesAfter(2))).toThrow(
        SyncRunNotRunningError,
      );
    });

    it('al vencer termina con error y explica por qué', () => {
      const expired = SyncRun.start('run-1', T0).expire(
        TIMEOUT,
        minutesAfter(31),
      );

      expect(expired).toMatchObject({
        status: 'ERROR',
        finishedAt: minutesAfter(31),
      });
      expect(expired.errorMessage).toContain('30 minutos');
    });
  });

  describe('el cierre', () => {
    it('completa termina OK, sin motivo de error', () => {
      const run = SyncRun.start('run-1', T0).complete(minutesAfter(2));

      expect(run).toMatchObject({
        status: 'OK',
        finishedAt: minutesAfter(2),
        errorMessage: null,
      });
    });

    it('con error guarda el motivo sin espacios sobrantes', () => {
      const run = SyncRun.start('run-1', T0).fail(
        '  Everything no respondió  ',
        minutesAfter(2),
      );

      expect(run).toMatchObject({
        status: 'ERROR',
        errorMessage: 'Everything no respondió',
      });
    });

    it('un motivo vacío se reemplaza por uno genérico: un ERROR siempre tiene motivo', () => {
      const run = SyncRun.start('run-1', T0).fail('   ', minutesAfter(2));

      expect(run.errorMessage).not.toBe('');
      expect(run.errorMessage).toEqual(expect.any(String));
    });

    it('recorta un motivo de más de 1000 caracteres sin partir un emoji', () => {
      const run = SyncRun.start('run-1', T0).fail(
        `${'a'.repeat(MAX_SYNC_ERROR_LENGTH - 2)}😀b`,
        minutesAfter(2),
      );

      expect(run.errorMessage).toBe(
        `${'a'.repeat(MAX_SYNC_ERROR_LENGTH - 2)}…`,
      );
      expect(Buffer.from(run.errorMessage!, 'utf8').toString('utf8')).toBe(
        run.errorMessage,
      );
    });

    it('solo termina una vez', () => {
      const ended = SyncRun.start('run-1', T0).fail('x', minutesAfter(1));

      expect(() => ended.complete(minutesAfter(2))).toThrow(
        SyncRunNotRunningError,
      );
      expect(() => ended.fail('y', minutesAfter(2))).toThrow(
        SyncRunNotRunningError,
      );
    });

    it('el fin nunca queda antes del inicio, aunque otra instancia tenga el reloj atrasado', () => {
      const run = SyncRun.start('run-1', T0).complete(minutesAfter(-1));

      expect(run.finishedAt).toEqual(T0);
    });
  });
});
