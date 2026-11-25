import { SyncRun } from '../../domain/entities/sync-run.entity';
import type { ReceivedSyncPage } from '../../domain/value-objects/received-sync-page';
import { RequestedSyncRunResponseDto } from '../dto/requested-sync-run-response.dto';
import { SyncPageResponseDto } from '../dto/sync-page-response.dto';
import {
  ClosedSyncRunResponseDto,
  SyncRunResponseDto,
} from '../dto/sync-run-response.dto';
import type { SyncRunSummary } from '../dto/sync-run-summary';

/**
 * The answers about a run: to the ingest endpoints of the agent (HU-137), to
 * its question whether a run is requested and to «Sincronizar ahora» (HU-138).
 */
export class SyncRunResponseMapper {
  static toDto(run: SyncRun): SyncRunResponseDto {
    return {
      id: run.id,
      status: run.status,
      requestedAt: run.requestedAt?.toISOString() ?? null,
      startedAt: run.startedAt?.toISOString() ?? null,
      lastActivityAt: run.lastActivityAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      filesCount: run.filesCount,
      errorMessage: run.errorMessage,
    };
  }

  static toClosedDto(
    run: SyncRun,
    summary: SyncRunSummary | null,
  ): ClosedSyncRunResponseDto {
    return {
      ...SyncRunResponseMapper.toDto(run),
      summary: summary ? { ...summary } : null,
    };
  }

  static toPageDto(run: SyncRun, page: ReceivedSyncPage): SyncPageResponseDto {
    return {
      runId: run.id,
      pageNumber: page.number,
      results: page.resultsCount,
      folders: page.folders.length,
      filesCount: run.filesCount,
    };
  }

  /** The run PEDIDA, if there is one, as the agent asks for it. */
  static toRequestedDto(
    requested: SyncRun | null,
  ): RequestedSyncRunResponseDto {
    return {
      requested: requested !== null,
      requestedAt: requested?.requestedAt?.toISOString() ?? null,
    };
  }
}
