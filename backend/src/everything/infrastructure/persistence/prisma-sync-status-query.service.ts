import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ISyncStatusQueryService,
  SyncStatusSnapshot,
} from '../../application/ports/sync-status-query.port';
import { SYNC_AGENT_ROW } from '../mappers/prisma-sync-agent.mapper';
import { PrismaSyncStatusMapper } from '../mappers/prisma-sync-status.mapper';

const OPEN = ['PEDIDA', 'EN_CURSO'];
const FINISHED = ['OK', 'ERROR'];

/** The screen of the sync, read from sync_runs and sync_agent (HU-138). */
@Injectable()
export class PrismaSyncStatusQueryService implements ISyncStatusQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<SyncStatusSnapshot> {
    // REPEATABLE READ: the three reads see one same snapshot of the database.
    // In READ COMMITTED, the default, each read sees what was committed when
    // it started, so a run the agent closes between two of them would show up
    // neither as the current run nor as the last one
    const [currentRun, lastRun, agent] = await this.prisma.$transaction(
      [
        // Never more than one: sync_runs_single_open_idx
        this.prisma.syncRunModel.findFirst({
          where: { status: { in: OPEN } },
        }),
        // Two runs never overlap, so the last one started is the last one
        // ended (sync_runs_started_at_idx)
        this.prisma.syncRunModel.findFirst({
          where: { status: { in: FINISHED } },
          orderBy: { startedAt: 'desc' },
        }),
        this.prisma.syncAgentModel.findUnique({
          where: { id: SYNC_AGENT_ROW },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return PrismaSyncStatusMapper.toSnapshot(currentRun, lastRun, agent);
  }
}
