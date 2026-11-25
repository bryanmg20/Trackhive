import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SyncAgent } from '../../domain/entities/sync-agent.entity';
import type { ISyncAgentRepository } from '../../domain/repositories/sync-agent.repository';
import {
  PrismaSyncAgentMapper,
  SYNC_AGENT_ROW,
} from '../mappers/prisma-sync-agent.mapper';

/** sync_agent: the agent of the CLENA as Trackhive knows it (HU-138). */
@Injectable()
export class PrismaSyncAgentRepository implements ISyncAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(agent: SyncAgent): Promise<void> {
    // INSERT … ON CONFLICT: two calls of the agent at once never collide
    await this.prisma.syncAgentModel.upsert({
      where: { id: SYNC_AGENT_ROW },
      create: PrismaSyncAgentMapper.toCreate(agent),
      update: PrismaSyncAgentMapper.toUpdate(agent),
    });
  }
}
