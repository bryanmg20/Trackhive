import { Prisma, SyncAgentModel } from '@prisma/client';
import { SyncAgent } from '../../domain/entities/sync-agent.entity';

// sync_agent has a single row (CHECK id = 1 in the migration)
export const SYNC_AGENT_ROW = 1;

/** sync_agent ↔ SyncAgent (HU-138, D-05). */
export class PrismaSyncAgentMapper {
  static toDomain(model: SyncAgentModel): SyncAgent {
    return new SyncAgent({ lastContactAt: model.lastContactAt });
  }

  static toCreate(agent: SyncAgent): Prisma.SyncAgentModelUncheckedCreateInput {
    return { id: SYNC_AGENT_ROW, lastContactAt: agent.lastContactAt };
  }

  static toUpdate(agent: SyncAgent): Prisma.SyncAgentModelUncheckedUpdateInput {
    return { lastContactAt: agent.lastContactAt };
  }
}
