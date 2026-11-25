import { Inject, Injectable } from '@nestjs/common';
import type { ISyncRunRepository } from '../../domain/repositories/sync-run.repository';
import { RequestedSyncRunResponseDto } from '../dto/requested-sync-run-response.dto';
import { SyncRunResponseMapper } from '../mappers/sync-run-response.mapper';
import { SYNC_RUN_REPOSITORY } from '../tokens';

/**
 * The agent of the CLENA asks whether an administrator pressed «Sincronizar
 * ahora» (HU-138). It asks every minute while the PC is on (HU-166); if a run
 * is PEDIDA it starts the sync, and the start takes that run.
 */
@Injectable()
export class GetRequestedSyncRunUseCase {
  constructor(
    @Inject(SYNC_RUN_REPOSITORY)
    private readonly runs: ISyncRunRepository,
  ) {}

  async execute(): Promise<RequestedSyncRunResponseDto> {
    return SyncRunResponseMapper.toRequestedDto(
      await this.runs.findRequested(),
    );
  }
}
