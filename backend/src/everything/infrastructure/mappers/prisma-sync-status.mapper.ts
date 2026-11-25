import { SyncAgentModel, SyncRunModel } from '@prisma/client';
import type { SyncStatusSnapshot } from '../../application/ports/sync-status-query.port';
import { PrismaSyncAgentMapper } from './prisma-sync-agent.mapper';
import { PrismaSyncRunMapper } from './prisma-sync-run.mapper';

/** The rows the screen of the sync reads → its snapshot (HU-138, D-05). */
export class PrismaSyncStatusMapper {
  static toSnapshot(
    currentRun: SyncRunModel | null,
    lastRun: SyncRunModel | null,
    agent: SyncAgentModel | null,
  ): SyncStatusSnapshot {
    return {
      currentRun: currentRun ? PrismaSyncRunMapper.toDomain(currentRun) : null,
      lastRun: lastRun ? PrismaSyncRunMapper.toDomain(lastRun) : null,
      agent: agent ? PrismaSyncAgentMapper.toDomain(agent) : null,
    };
  }
}
