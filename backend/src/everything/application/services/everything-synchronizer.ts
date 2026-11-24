import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { EverythingPageTooLargeError } from '../../domain/errors/everything-page-too-large.error';
import { SyncRunAlreadyRunningError } from '../../domain/errors/sync-run-already-running.error';
import { SyncRunExpiredError } from '../../domain/errors/sync-run-expired.error';
import { SyncRunNotFoundError } from '../../domain/errors/sync-run-not-found.error';
import { SyncRunNotRunningError } from '../../domain/errors/sync-run-not-running.error';
import { incompleteRunReason } from '../../domain/policies/sync-completeness';
import type { ISyncRunRepository } from '../../domain/repositories/sync-run.repository';
import type { ReceivedSyncPage } from '../../domain/value-objects/received-sync-page';
import type { CloseSyncRunInput } from '../dto/close-sync-run.input';
import type { EverythingSyncConfig } from '../dto/everything-sync-config';
import type { ParsedLeaf } from '../dto/parsed-leaf';
import type { ReceiveSyncPageInput } from '../dto/receive-sync-page.input';
import { SyncPageResponseDto } from '../dto/sync-page-response.dto';
import {
  ClosedSyncRunResponseDto,
  SyncRunResponseDto,
} from '../dto/sync-run-response.dto';
import { EverythingPageMapper } from '../mappers/everything-page.mapper';
import { SyncPageMapper } from '../mappers/sync-page.mapper';
import { SyncRunResponseMapper } from '../mappers/sync-run-response.mapper';
import { SyncedMaterialMapper } from '../mappers/synced-material.mapper';
import { MAX_RESULTS_PER_PAGE } from '../sync-limits';
import { EVERYTHING_SYNC_CONFIG, SYNC_RUN_REPOSITORY } from '../tokens';
import { LeafFolderParser } from './leaf-folder-parser';

const NO_LEAVES =
  'La corrida no trajo ninguna carpeta hoja bajo las raíces de los fondos ' +
  '(config/catalog-convention.json): Everything no ve la unidad de las copias ' +
  'o las raíces están mal. No se marcó nada como no encontrado';

/**
 * The Everything sync (HU-137). The agent (HU-166) drives it with three
 * operations, one per ingest endpoint:
 *
 * 1. startRun: the lock and the row of sync_runs.
 * 2. receivePage: maps the page (HU-135) and keeps its folders, in its own
 *    transaction, until the run closes.
 * 3. closeRun: when the run is complete, parses every folder at once
 *    (HU-136) and saves the materials of each page in its own transaction
 *    (upsert by catalog code); only then marks as «copia digital no
 *    encontrada» what it did not see.
 *
 * The leaves and the repeated codes are only known with every folder:
 * Everything sorts by name and mixes the levels across pages (the month
 * folders of a year can come one page after the year), so the materials are
 * saved when the run closes, never page by page as the pages arrive.
 */
@Injectable()
export class EverythingSynchronizer {
  private readonly logger = new Logger(EverythingSynchronizer.name);

  constructor(
    @Inject(SYNC_RUN_REPOSITORY)
    private readonly runs: ISyncRunRepository,
    @Inject(EVERYTHING_SYNC_CONFIG)
    private readonly config: EverythingSyncConfig,
    private readonly parser: LeafFolderParser,
  ) {}

  /**
   * Starts a run. Another run EN_CURSO that has not expired answers 409;
   * one that expired ends with an error first, marking nothing as not found.
   */
  async startRun(now: Date = new Date()): Promise<SyncRunResponseDto> {
    const running = await this.runs.findRunning();
    if (running) {
      if (!running.isExpired(this.timeoutMinutes, now)) {
        throw new SyncRunAlreadyRunningError();
      }
      await this.expire(running, now);
    }
    const run = SyncRun.start(randomUUID(), now);
    await this.runs.create(run);
    this.logger.log(`Sync run ${run.id} started`);
    return SyncRunResponseMapper.toDto(run);
  }

  /**
   * Checks a page (its size and the shape of Everything, HU-135) and keeps
   * its folders until the run closes, in one transaction. A page that does
   * not pass is rejected whole: nothing of it is saved.
   */
  async receivePage(
    input: ReceiveSyncPageInput,
    now: Date = new Date(),
  ): Promise<SyncPageResponseDto> {
    const results = EverythingSynchronizer.resultsIn(input.page);
    if (results > MAX_RESULTS_PER_PAGE) {
      throw new EverythingPageTooLargeError(results, MAX_RESULTS_PER_PAGE);
    }
    const records = EverythingPageMapper.toDocumentRecords(input.page);
    const run = await this.openRun(input.runId, now);
    const page = SyncPageMapper.toPage(input.pageNumber, records, now);
    const saved = await this.runs.savePage(run.recordActivity(now), page);
    return SyncRunResponseMapper.toPageDto(saved, page);
  }

  /**
   * Closes a run. With an error, it ends ERROR and no material changes.
   * Complete, it saves the materials and marks what it did not see; if the
   * pages 1..pageCount did not arrive, or no leaf did, it ends ERROR instead
   * and marks nothing.
   */
  async closeRun(
    input: CloseSyncRunInput,
    now: Date = new Date(),
  ): Promise<ClosedSyncRunResponseDto> {
    const run = await this.openRun(input.runId, now);
    if (input.result === 'ERROR') {
      return this.failRun(run, input.errorMessage ?? '', now);
    }
    try {
      return await this.completeRun(run, input.pageCount ?? 0, now);
    } catch (error) {
      // Another instance ended it: there is nothing left to close
      if (!(error instanceof SyncRunNotRunningError)) {
        await this.failQuietly(
          run,
          `No se pudo cerrar la corrida: ${EverythingSynchronizer.messageOf(error)}`,
          now,
        );
      }
      throw error;
    }
  }

  private get timeoutMinutes(): number {
    return this.config.runTimeoutMinutes;
  }

  /** The run takes pages and its close: it exists, is EN_CURSO and alive. */
  private async openRun(runId: string, now: Date): Promise<SyncRun> {
    const run = await this.runs.findById(runId);
    if (!run) {
      throw new SyncRunNotFoundError();
    }
    if (run.isExpired(this.timeoutMinutes, now)) {
      await this.expire(run, now);
      throw new SyncRunExpiredError(this.timeoutMinutes);
    }
    run.assertOpen(this.timeoutMinutes, now);
    return run;
  }

  private async completeRun(
    run: SyncRun,
    pageCount: number,
    now: Date,
  ): Promise<ClosedSyncRunResponseDto> {
    const pages = await this.runs.findPages(run.id);
    const incomplete = incompleteRunReason(
      pageCount,
      pages.map((page) => page.number),
    );
    if (incomplete) {
      return this.failRun(run, incomplete, now);
    }

    const leaves = this.parser.parse(SyncPageMapper.toRecords(pages));
    if (leaves.length === 0) {
      return this.failRun(run, NO_LEAVES, now);
    }

    // Every material of the run is seen now: what is older was not seen
    const seenAt = now;
    let created = 0;
    let updated = 0;
    for (const group of EverythingSynchronizer.byPage(pages, leaves)) {
      const saved = await this.runs.saveMaterials(
        group.map((leaf) => SyncedMaterialMapper.fromLeaf(leaf, seenAt)),
      );
      created += saved.created;
      updated += saved.updated;
    }

    const completed = run.complete(now);
    const notFound = await this.runs.complete(completed, seenAt);
    const forReview = leaves.filter((leaf) => leaf.needsReview).length;
    this.logger.log(
      `Sync run ${run.id} completed: ${leaves.length} leaf folders ` +
        `(${created} created, ${updated} updated, ${forReview} for review), ` +
        `${notFound} digital copies not found`,
    );
    return SyncRunResponseMapper.toClosedDto(completed, {
      leaves: leaves.length,
      created,
      updated,
      notFound,
      forReview,
    });
  }

  /** Ends the run with an error: no material changes, nothing is marked. */
  private async failRun(
    run: SyncRun,
    reason: string,
    now: Date,
  ): Promise<ClosedSyncRunResponseDto> {
    const failed = run.fail(reason, now);
    await this.runs.finish(failed);
    this.logger.warn(
      `Sync run ${run.id} ended with an error: ${failed.errorMessage}`,
    );
    return SyncRunResponseMapper.toClosedDto(failed, null);
  }

  /** On an unexpected error the run must not stay EN_CURSO until it expires. */
  private async failQuietly(
    run: SyncRun,
    reason: string,
    now: Date,
  ): Promise<void> {
    try {
      await this.failRun(run, reason, now);
    } catch (error) {
      this.logger.error(
        `Sync run ${run.id} could not be ended with an error: ${EverythingSynchronizer.messageOf(error)}`,
      );
    }
  }

  /**
   * Ends a run that spent the timeout without pages. If another instance
   * ended it first, or a page arrived meanwhile, there is nothing to do.
   */
  private async expire(run: SyncRun, now: Date): Promise<void> {
    try {
      await this.runs.finish(
        run.expire(this.timeoutMinutes, now),
        SyncRun.inactiveBefore(this.timeoutMinutes, now),
      );
      this.logger.warn(
        `Sync run ${run.id} expired after ${this.timeoutMinutes} minutes without pages; nothing was marked as not found`,
      );
    } catch (error) {
      if (!(error instanceof SyncRunNotRunningError)) {
        throw error;
      }
    }
  }

  /**
   * The leaves grouped by the page where their folder arrived first, in page
   * order: each group is saved in its own transaction.
   */
  private static byPage(
    pages: readonly ReceivedSyncPage[],
    leaves: readonly ParsedLeaf[],
  ): ParsedLeaf[][] {
    const pageOf = new Map<string, number>();
    for (const page of pages) {
      for (const folder of page.folders) {
        if (!pageOf.has(folder.fullPath)) {
          pageOf.set(folder.fullPath, page.number);
        }
      }
    }
    const groups = new Map<number, ParsedLeaf[]>();
    for (const leaf of leaves) {
      const number = pageOf.get(leaf.fullPath) ?? 0;
      groups.set(number, [...(groups.get(number) ?? []), leaf]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, group]) => group);
  }

  /** Results of a raw page, before mapping it; 0 if it has no list. */
  private static resultsIn(page: unknown): number {
    const results = (page as { results?: unknown } | null | undefined)?.results;
    return Array.isArray(results) ? results.length : 0;
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
