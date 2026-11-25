import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ISyncAgentRepository } from '../../domain/repositories/sync-agent.repository';
import {
  PrismaSyncAgentMapper,
  SYNC_AGENT_ROW,
} from '../mappers/prisma-sync-agent.mapper';

/** sync_agent: when the agent of the CLENA last called Trackhive (HU-138). */
@Injectable()
export class PrismaSyncAgentRepository implements ISyncAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordContact(at: Date): Promise<void> {
    // The first contact creates the row; every other one updates it
    await this.prisma.syncAgentModel.upsert({
      where: { id: SYNC_AGENT_ROW },
      create: PrismaSyncAgentMapper.toCreate(at),
      update: PrismaSyncAgentMapper.toContact(at),
    });
  }

  async findLastContact(): Promise<Date | null> {
    const model = await this.prisma.syncAgentModel.findUnique({
      where: { id: SYNC_AGENT_ROW },
    });
    return PrismaSyncAgentMapper.toLastContact(model);
  }
}
