import { Prisma, SyncRunModel, SyncRunPageModel } from '@prisma/client';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { InvalidSyncRunStatusError } from '../../domain/errors/invalid-sync-run-status.error';
import { isSyncRunStatus } from '../../domain/enums/sync-run-status';
import type {
  ReceivedSyncPage,
  SyncFolder,
} from '../../domain/value-objects/received-sync-page';

/**
 * How a folder is stored in the JSON of sync_run_pages.folders. A type, not
 * an interface, so it is a valid JSON object for Prisma.
 */
type StoredFolder = {
  fullPath: string;
  modifiedAt: string;
};

/** The columns of a page that a retry replaces. */
interface PageColumns {
  resultsCount: number;
  folders: Prisma.InputJsonValue;
  receivedAt: Date;
}

const isStoredFolder = (value: unknown): value is StoredFolder =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as StoredFolder).fullPath === 'string' &&
  typeof (value as StoredFolder).modifiedAt === 'string';

/** sync_runs and sync_run_pages ↔ SyncRun and its pages (HU-137, D-05). */
export class PrismaSyncRunMapper {
  static toDomain(model: SyncRunModel): SyncRun {
    if (!isSyncRunStatus(model.status)) {
      throw new InvalidSyncRunStatusError();
    }
    return new SyncRun({
      id: model.id,
      status: model.status,
      requestedAt: model.requestedAt,
      requestedById: model.requestedById,
      startedAt: model.startedAt,
      lastActivityAt: model.lastActivityAt,
      finishedAt: model.finishedAt,
      filesCount: model.filesCount,
      errorMessage: model.errorMessage,
    });
  }

  /** A run the agent starts (EN_CURSO) or an administrator asks for (PEDIDA). */
  static toCreate(run: SyncRun): Prisma.SyncRunModelUncheckedCreateInput {
    return {
      id: run.id,
      status: run.status,
      requestedAt: run.requestedAt,
      requestedById: run.requestedById,
      startedAt: run.startedAt,
      lastActivityAt: run.lastActivityAt,
      finishedAt: run.finishedAt,
      filesCount: run.filesCount,
      errorMessage: run.errorMessage,
    };
  }

  /** The agent took the run PEDIDA: it started (HU-138). */
  static toTake(run: SyncRun): Prisma.SyncRunModelUncheckedUpdateManyInput {
    return {
      status: run.status,
      startedAt: run.startedAt,
      lastActivityAt: run.lastActivityAt,
    };
  }

  /** A page arrived: the activity of the run. */
  static toActivity(run: SyncRun): Prisma.SyncRunModelUncheckedUpdateManyInput {
    return { lastActivityAt: run.lastActivityAt };
  }

  /** The results of every page the run has, retries counted once. */
  static toFilesCount(
    filesCount: number,
  ): Prisma.SyncRunModelUncheckedUpdateInput {
    return { filesCount };
  }

  /** The end of the run, OK or ERROR. files_count already has its pages. */
  static toFinish(run: SyncRun): Prisma.SyncRunModelUncheckedUpdateManyInput {
    return {
      status: run.status,
      finishedAt: run.finishedAt,
      errorMessage: run.errorMessage,
    };
  }

  static toPageCreate(
    runId: string,
    page: ReceivedSyncPage,
  ): Prisma.SyncRunPageModelUncheckedCreateInput {
    return {
      syncRunId: runId,
      pageNumber: page.number,
      ...PrismaSyncRunMapper.toPageUpdate(page),
    };
  }

  /** The same page sent again replaces the one before. */
  static toPageUpdate(page: ReceivedSyncPage): PageColumns {
    return {
      resultsCount: page.resultsCount,
      folders: page.folders.map((folder): StoredFolder => ({
        fullPath: folder.fullPath,
        modifiedAt: folder.modifiedAt.toISOString(),
      })),
      receivedAt: page.receivedAt,
    };
  }

  static toPage(model: SyncRunPageModel): ReceivedSyncPage {
    if (!Array.isArray(model.folders)) {
      throw new Error(
        `sync_run_pages ${model.syncRunId}/${model.pageNumber}: folders no es una lista`,
      );
    }
    return {
      number: model.pageNumber,
      resultsCount: model.resultsCount,
      folders: model.folders.map((folder): SyncFolder => {
        if (!isStoredFolder(folder)) {
          throw new Error(
            `sync_run_pages ${model.syncRunId}/${model.pageNumber}: una carpeta no tiene fullPath y modifiedAt`,
          );
        }
        return {
          fullPath: folder.fullPath,
          modifiedAt: new Date(folder.modifiedAt),
        };
      }),
      receivedAt: model.receivedAt,
    };
  }
}
