import { SyncAgent } from './sync-agent.entity';

describe('SyncAgent (HU-138)', () => {
  it('un contacto del agente deja su momento como el último', () => {
    const now = new Date('2026-11-24T15:00:00.000Z');

    expect(SyncAgent.contact(now)).toEqual(
      new SyncAgent({ lastContactAt: now }),
    );
  });

  it('sin momento, el contacto es ahora', () => {
    const before = Date.now();

    const { lastContactAt } = SyncAgent.contact();

    expect(lastContactAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(lastContactAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
