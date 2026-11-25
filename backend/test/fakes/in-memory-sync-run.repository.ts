import type { MaterialReviewReason } from '../../src/materials/domain/enums/material-review-reason';
import { SyncRun } from '../../src/everything/domain/entities/sync-run.entity';
import { SyncRunAlreadyRunningError } from '../../src/everything/domain/errors/sync-run-already-running.error';
import { SyncRunNotRunningError } from '../../src/everything/domain/errors/sync-run-not-running.error';
import type {
  ISyncRunRepository,
  SavedMaterialsCount,
} from '../../src/everything/domain/repositories/sync-run.repository';
import type { ReceivedSyncPage } from '../../src/everything/domain/value-objects/received-sync-page';
import type { SyncedMaterial } from '../../src/everything/domain/value-objects/synced-material';

export interface StoredMaterial {
  id: string;
  catalogCode: string;
  title: string;
  collection: string;
  materialType: string;
  status: string;
  source: 'MANUAL' | 'EVERYTHING';
  digitalPath: string | null;
  lastSeenAt: Date | null;
  reviewReason: MaterialReviewReason | null;
  author: string | null;
}

/**
 * ISyncRunRepository in memory (D-21), with the same rules as PostgreSQL:
 * one run PEDIDA or EN_CURSO at a time, guards on the status, upsert by
 * catalog code and the marking of the copies not seen (HU-137, HU-138).
 */
export class InMemorySyncRunRepository implements ISyncRunRepository {
  readonly runs = new Map<string, SyncRun>();
  readonly pages = new Map<string, Map<number, ReceivedSyncPage>>();
  readonly materials = new Map<string, StoredMaterial>();
  readonly savedGroups: SyncedMaterial[][] = [];
  failSavingMaterials: Error | null = null;
  private nextId = 1;

  create(run: SyncRun): Promise<void> {
    // sync_runs_single_open_idx
    if (
      [...this.runs.values()].some(
        (stored) => stored.isRunning || stored.isRequested,
      )
    ) {
      return Promise.reject(new SyncRunAlreadyRunningError());
    }
    this.runs.set(run.id, run);
    this.pages.set(run.id, new Map());
    return Promise.resolve();
  }

  findById(id: string): Promise<SyncRun | null> {
    return Promise.resolve(this.runs.get(id) ?? null);
  }

  findRunning(): Promise<SyncRun | null> {
    return Promise.resolve(
      [...this.runs.values()].find((run) => run.isRunning) ?? null,
    );
  }

  findRequested(): Promise<SyncRun | null> {
    return Promise.resolve(
      [...this.runs.values()].find((run) => run.isRequested) ?? null,
    );
  }

  findLastFinished(): Promise<SyncRun | null> {
    const finished = [...this.runs.values()]
      .filter((run) => run.status === 'OK' || run.status === 'ERROR')
      .sort(
        (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
      );
    return Promise.resolve(finished[0] ?? null);
  }

  take(run: SyncRun): Promise<void> {
    if (!this.runs.get(run.id)?.isRequested) {
      return Promise.reject(new SyncRunAlreadyRunningError());
    }
    this.runs.set(run.id, run);
    this.pages.set(run.id, new Map());
    return Promise.resolve();
  }

  savePage(run: SyncRun, page: ReceivedSyncPage): Promise<SyncRun> {
    const stored = this.runs.get(run.id);
    if (!stored?.isRunning) {
      return Promise.reject(new SyncRunNotRunningError());
    }
    const pages = this.pages.get(run.id)!;
    pages.set(page.number, page);
    const filesCount = [...pages.values()].reduce(
      (sum, saved) => sum + saved.resultsCount,
      0,
    );
    const updated = new SyncRun({
      ...stored,
      lastActivityAt: run.lastActivityAt,
      filesCount,
    });
    this.runs.set(run.id, updated);
    return Promise.resolve(updated);
  }

  findPages(runId: string): Promise<ReceivedSyncPage[]> {
    return Promise.resolve(
      [...(this.pages.get(runId)?.values() ?? [])].sort(
        (a, b) => a.number - b.number,
      ),
    );
  }

  saveMaterials(materials: SyncedMaterial[]): Promise<SavedMaterialsCount> {
    this.savedGroups.push(materials);
    if (this.failSavingMaterials) {
      return Promise.reject(this.failSavingMaterials);
    }
    let created = 0;
    for (const material of materials) {
      const existing = this.materials.get(material.catalogCode);
      if (!existing) {
        created++;
      }
      this.materials.set(material.catalogCode, {
        // What the sync does not know stays as it was
        id: existing?.id ?? `material-${this.nextId++}`,
        status: existing?.status ?? 'DISPONIBLE',
        author: existing?.author ?? null,
        catalogCode: material.catalogCode,
        title: material.title,
        collection: material.collection,
        materialType: material.materialType,
        source: 'EVERYTHING',
        digitalPath: material.digitalPath,
        lastSeenAt: material.seenAt,
        reviewReason: material.reviewReason,
      });
    }
    return Promise.resolve({ created, updated: materials.length - created });
  }

  finish(run: SyncRun, inactiveBefore?: Date): Promise<void> {
    const stored = this.runs.get(run.id);
    if (
      !stored?.isRunning ||
      (inactiveBefore && !(stored.lastActivityAt < inactiveBefore))
    ) {
      return Promise.reject(new SyncRunNotRunningError());
    }
    this.end(stored, run);
    return Promise.resolve();
  }

  complete(run: SyncRun, seenAt: Date): Promise<number> {
    const stored = this.runs.get(run.id);
    if (!stored?.isRunning) {
      return Promise.reject(new SyncRunNotRunningError());
    }
    let notFound = 0;
    for (const material of this.materials.values()) {
      if (
        material.source === 'EVERYTHING' &&
        material.digitalPath !== null &&
        (material.lastSeenAt === null || material.lastSeenAt < seenAt)
      ) {
        material.digitalPath = null;
        notFound++;
      }
    }
    this.end(stored, run);
    return Promise.resolve(notFound);
  }

  addMaterial(material: Partial<StoredMaterial> & { catalogCode: string }) {
    this.materials.set(material.catalogCode, {
      id: `seed-${material.catalogCode}`,
      title: material.catalogCode,
      collection: 'Notarías',
      materialType: 'PROTOCOLO_NOTARIAL',
      status: 'DISPONIBLE',
      source: 'EVERYTHING',
      digitalPath: null,
      lastSeenAt: new Date('2026-11-01T00:00:00.000Z'),
      reviewReason: null,
      author: null,
      ...material,
    });
  }

  private end(stored: SyncRun, ended: SyncRun): void {
    this.runs.set(
      stored.id,
      new SyncRun({
        ...stored,
        status: ended.status,
        finishedAt: ended.finishedAt,
        errorMessage: ended.errorMessage,
      }),
    );
    this.pages.set(stored.id, new Map());
  }
}
