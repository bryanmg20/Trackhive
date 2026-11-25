import { InMemorySyncAgentRepository } from '../../../../test/fakes/in-memory-sync-agent.repository';
import { RecordAgentContactUseCase } from './record-agent-contact.use-case';

const NOW = new Date('2026-11-24T15:00:00.000Z');

describe('RecordAgentContactUseCase (HU-138)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('guarda el momento en que el agente llamó a Trackhive', async () => {
    jest.useFakeTimers({ now: NOW });
    const agent = new InMemorySyncAgentRepository();

    await new RecordAgentContactUseCase(agent).execute();

    expect(await agent.findLastContact()).toEqual(NOW);
  });
});
