import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { SyncRunAlreadyRunningError } from '../../domain/errors/sync-run-already-running.error';
import { SyncRunNotRunningError } from '../../domain/errors/sync-run-not-running.error';
import type {
  ISyncRunRepository,
  SavedMaterialsCount,
} from '../../domain/repositories/sync-run.repository';
import type { ReceivedSyncPage } from '../../domain/value-objects/received-sync-page';
import type { SyncedMaterial } from '../../domain/value-objects/synced-material';
import { PrismaSyncRunMapper } from '../mappers/prisma-sync-run.mapper';
import { PrismaSyncedMaterialMapper } from '../mappers/prisma-synced-material.mapper';

const RUNNING = 'EN_CURSO';
const UNIQUE_CONSTRAINT_ERROR = 'P2002';

/** sync_runs, sync_run_pages and the materials a run brings (HU-137). */
@Injectable()
export class PrismaSyncRunRepository implements ISyncRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(run: SyncRun): Promise<void> {
    try {
      await this.prisma.syncRunModel.create({
        data: PrismaSyncRunMapper.toCreate(run),
      });
    } catch (error) {
      // sync_runs_single_running_idx: another run is EN_CURSO, maybe
      // started by another instance of the backend at the same time
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_ERROR
      ) {
        throw new SyncRunAlreadyRunningError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<SyncRun | null> {
    const model = await this.prisma.syncRunModel.findUnique({ where: { id } });
    return model ? PrismaSyncRunMapper.toDomain(model) : null;
  }

  async findRunning(): Promise<SyncRun | null> {
    const model = await this.prisma.syncRunModel.findFirst({
      where: { status: RUNNING },
    });
    return model ? PrismaSyncRunMapper.toDomain(model) : null;
  }

  async savePage(run: SyncRun, page: ReceivedSyncPage): Promise<SyncRun> {
    // The page and the activity of its run, together or not at all
    return this.prisma.$transaction(async (tx) => {
      // Only a run still EN_CURSO: if it ended meanwhile, nothing is saved
      const { count } = await tx.syncRunModel.updateMany({
        where: { id: run.id, status: RUNNING },
        data: PrismaSyncRunMapper.toActivity(run),
      });
      if (count === 0) {
        throw new SyncRunNotRunningError();
      }

      await tx.syncRunPageModel.upsert({
        where: {
          syncRunId_pageNumber: { syncRunId: run.id, pageNumber: page.number },
        },
        create: PrismaSyncRunMapper.toPageCreate(run.id, page),
        update: PrismaSyncRunMapper.toPageUpdate(page),
      });

      // Counted again from the pages, so a retried page counts once
      const { _sum } = await tx.syncRunPageModel.aggregate({
        where: { syncRunId: run.id },
        _sum: { resultsCount: true },
      });
      const model = await tx.syncRunModel.update({
        where: { id: run.id },
        data: PrismaSyncRunMapper.toFilesCount(_sum.resultsCount ?? 0),
      });
      return PrismaSyncRunMapper.toDomain(model);
    });
  }

  async findPages(runId: string): Promise<ReceivedSyncPage[]> {
    const models = await this.prisma.syncRunPageModel.findMany({
      where: { syncRunId: runId },
      orderBy: { pageNumber: 'asc' },
    });
    return models.map((model) => PrismaSyncRunMapper.toPage(model));
  }

  async saveMaterials(
    materials: SyncedMaterial[],
  ): Promise<SavedMaterialsCount> {
    if (materials.length === 0) {
      return { created: 0, updated: 0 };
    }
    // Only a run EN_CURSO writes materials, and only one is EN_CURSO, so
    // nobody creates these codes between the count and the upserts
    const existing = await this.prisma.materialModel.count({
      where: {
        catalogCode: { in: materials.map((material) => material.catalogCode) },
      },
    });
    // The materials of one page together, or none of them. By catalog code,
    // never by path: a renamed folder with the same code updates its material
    await this.prisma.$transaction(
      materials.map((material) =>
        this.prisma.materialModel.upsert({
          where: { catalogCode: material.catalogCode },
          create: PrismaSyncedMaterialMapper.toCreate(material, randomUUID()),
          update: PrismaSyncedMaterialMapper.toUpdate(material),
        }),
      ),
    );
    return { created: materials.length - existing, updated: existing };
  }

  async finish(run: SyncRun, inactiveBefore?: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.syncRunModel.updateMany({
        where: {
          id: run.id,
          status: RUNNING,
          // Expiry: only if no page arrived meanwhile
          ...(inactiveBefore ? { lastActivityAt: { lt: inactiveBefore } } : {}),
        },
        data: PrismaSyncRunMapper.toFinish(run),
      });
      if (count === 0) {
        throw new SyncRunNotRunningError();
      }
      await tx.syncRunPageModel.deleteMany({ where: { syncRunId: run.id } });
    });
  }

  async complete(run: SyncRun, seenAt: Date): Promise<number> {
    // The end of the run and the copies not found, together or not at all
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.syncRunModel.updateMany({
        where: { id: run.id, status: RUNNING },
        data: PrismaSyncRunMapper.toFinish(run),
      });
      if (count === 0) {
        throw new SyncRunNotRunningError();
      }
      // Every Everything material this run did not see. None is deleted: it
      // may have requests
      const notFound = await tx.materialModel.updateMany({
        where: {
          source: 'EVERYTHING',
          digitalPath: { not: null },
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: seenAt } }],
        },
        data: PrismaSyncedMaterialMapper.toDigitalCopyNotFound(),
      });
      await tx.syncRunPageModel.deleteMany({ where: { syncRunId: run.id } });
      return notFound.count;
    });
  }
}
