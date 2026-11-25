import { Prisma, SyncAgentModel } from '@prisma/client';

// sync_agent has a single row (CHECK id = 1 in the migration)
export const SYNC_AGENT_ROW = 1;

/** sync_agent ↔ the last contact of the agent (HU-138, D-05). */
export class PrismaSyncAgentMapper {
  static toCreate(at: Date): Prisma.SyncAgentModelUncheckedCreateInput {
    return { id: SYNC_AGENT_ROW, lastContactAt: at };
  }

  static toContact(at: Date): Prisma.SyncAgentModelUncheckedUpdateInput {
    return { lastContactAt: at };
  }

  static toLastContact(model: SyncAgentModel | null): Date | null {
    return model?.lastContactAt ?? null;
  }
}
