import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { InMemorySyncRunRepository } from '../../../../test/fakes/in-memory-sync-run.repository';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { EverythingPageTooLargeError } from '../../domain/errors/everything-page-too-large.error';
import { InvalidEverythingPageError } from '../../domain/errors/invalid-everything-page.error';
import { SyncRunAlreadyRunningError } from '../../domain/errors/sync-run-already-running.error';
import { SyncRunExpiredError } from '../../domain/errors/sync-run-expired.error';
import { SyncRunNotFoundError } from '../../domain/errors/sync-run-not-found.error';
import { SyncRunNotRunningError } from '../../domain/errors/sync-run-not-running.error';
import { CatalogConventionMapper } from '../mappers/catalog-convention.mapper';
import { MAX_RESULTS_PER_PAGE } from '../sync-limits';
import { EverythingSynchronizer } from './everything-synchronizer';
import { LeafFolderParser } from './leaf-folder-parser';
import { SyncRunExpirer } from './sync-run-expirer';

// Real answers of Everything, the manifest (HU-133) and the convention (HU-136)
const DEV = join(__dirname, '../../../../../dev');
const CONVENTION_FILE = join(
  __dirname,
  '../../../../config/catalog-convention.json',
);
const BASE = 'C:\\trackhive\\docs_simulados';
const PRIMERA = `${BASE}\\Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979`;
const ENE_1931 = `${PRIMERA}\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0001-0109 - Ene`;

const T0 = new Date('2026-11-23T11:00:00.000Z');
const later = (minutes: number): Date =>
  new Date(T0.getTime() + minutes * 60_000);
const TIMEOUT = 30;

interface RawPage {
  totalResults: number;
  results: { type: string; name: string; path: string }[];
}

interface ManifestLeaf {
  path: string;
  catalogCode: string;
  collection: string;
  needsReview: boolean;
  reviewReason: string | null;
}

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(file, 'utf8')) as T;
const fixture = (id: string): RawPage =>
  readJson<RawPage>(join(DEV, 'fixtures', `everything_${id}.json`));
const manifest = readJson<{ windowsRoot: string; leaves: ManifestLeaf[] }>(
  join(DEV, 'manifiesto.json'),
);
// The pages of the e2e and of the agent: notaries in three pages, periodicals
const FIXTURE_PAGES = [
  'carpetas_notarias_p1',
  'carpetas_notarias_p2',
  'carpetas_notarias_p3',
  'carpetas_periodicos',
];
// Every leaf of those pages: the manifest without the Correspondencia fund,
// which has no fixture
const EXPECTED_LEAVES = manifest.leaves.filter(
  (leaf) => leaf.collection !== 'Correspondencia',
);

describe('EverythingSynchronizer', () => {
  let repo: InMemorySyncRunRepository;
  let sync: EverythingSynchronizer;

  const convention = CatalogConventionMapper.fromJson(
    readJson<unknown>(CONVENTION_FILE),
  );

  /** Starts a run and sends the pages, numbered from 1, a minute apart. */
  const sendPages = async (pages: unknown[], at: Date = T0) => {
    const { id } = await sync.startRun(at);
    for (const [index, page] of pages.entries()) {
      await sync.receivePage(
        { runId: id, pageNumber: index + 1, page },
        new Date(at.getTime() + (index + 1) * 60_000),
      );
    }
    return id;
  };

  const fixturePages = (): RawPage[] => FIXTURE_PAGES.map(fixture);

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    repo = new InMemorySyncRunRepository();
    sync = new EverythingSynchronizer(
      repo,
      new LeafFolderParser(convention),
      new SyncRunExpirer(repo, {
        agentToken: 'token',
        runTimeoutMinutes: TIMEOUT,
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('iniciar corrida', () => {
    it('deja una corrida EN_CURSO en sync_runs', async () => {
      const run = await sync.startRun(T0);

      expect(run).toMatchObject({
        status: 'EN_CURSO',
        startedAt: T0.toISOString(),
        lastActivityAt: T0.toISOString(),
        finishedAt: null,
        filesCount: 0,
        errorMessage: null,
      });
      expect(repo.runs.get(run.id)?.status).toBe('EN_CURSO');
    });

    it('dado que ya hay una corrida abierta y no vencida, responde 409', async () => {
      await sync.startRun(T0);

      await expect(sync.startRun(later(TIMEOUT))).rejects.toThrow(
        SyncRunAlreadyRunningError,
      );
      expect(repo.runs.size).toBe(1);
    });

    it('dada una corrida vencida, la cierra con error, no marca nada e inicia otra', async () => {
      repo.addMaterial({
        catalogCode: 'NOT4-1956-0001-0180',
        digitalPath: `${BASE}\\vieja`,
      });
      const cut = await sendPages([fixture('carpetas_notarias_p1')]);

      const next = await sync.startRun(later(TIMEOUT + 2));

      expect(repo.runs.get(cut)).toMatchObject({ status: 'ERROR' });
      expect(repo.runs.get(cut)?.errorMessage).toContain('venció');
      expect(next.status).toBe('EN_CURSO');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('nothing was marked as not found'),
      );
      // The cut run saved no material and marked nothing
      expect(repo.savedGroups).toEqual([]);
      expect(repo.materials.get('NOT4-1956-0001-0180')?.digitalPath).toBe(
        `${BASE}\\vieja`,
      );
      expect(repo.pages.get(cut)?.size).toBe(0);
    });
  });

  describe('iniciar corrida con una pedida por «Sincronizar ahora» (HU-138)', () => {
    const ADMIN_ID = 'admin-1';

    it('el agente toma la corrida pedida: la misma corrida pasa a EN_CURSO y no se crea otra', async () => {
      const requested = SyncRun.request('pedida-1', ADMIN_ID, T0);
      await repo.create(requested);

      const run = await sync.startRun(later(5));

      expect(run).toMatchObject({
        id: 'pedida-1',
        status: 'EN_CURSO',
        requestedAt: T0.toISOString(),
        startedAt: later(5).toISOString(),
        lastActivityAt: later(5).toISOString(),
        finishedAt: null,
      });
      expect(repo.runs.size).toBe(1);
      expect(repo.runs.get('pedida-1')).toMatchObject({
        status: 'EN_CURSO',
        requestedById: ADMIN_ID,
      });
    });

    it('la corrida tomada recibe páginas y se cierra como cualquier otra, con su resultado', async () => {
      await repo.create(SyncRun.request('pedida-1', ADMIN_ID, T0));
      const id = await sendPages(fixturePages(), later(1));

      const closed = await sync.closeRun(
        { runId: id, result: 'OK', pageCount: 4 },
        later(20),
      );

      expect(id).toBe('pedida-1');
      expect(closed).toMatchObject({
        status: 'OK',
        requestedAt: T0.toISOString(),
        filesCount: 124 + 6,
      });
      expect(await repo.findLastFinished()).toMatchObject({
        id: 'pedida-1',
        status: 'OK',
      });
      expect(await repo.findRequested()).toBeNull();
    });

    it('una corrida pedida hace días no vence: el agente la toma cuando vuelve a encenderse el PC', async () => {
      await repo.create(SyncRun.request('pedida-1', ADMIN_ID, T0));

      const run = await sync.startRun(later(3 * 24 * 60));

      expect(run).toMatchObject({ id: 'pedida-1', status: 'EN_CURSO' });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('si un administrador la pide justo mientras el agente inicia su corrida diaria, el agente toma esa', async () => {
      // The agent read «nothing open»; the request is saved first
      jest.spyOn(repo, 'create').mockImplementationOnce(() => {
        repo.runs.set('pedida-1', SyncRun.request('pedida-1', ADMIN_ID, T0));
        return Promise.reject(new SyncRunAlreadyRunningError());
      });

      const run = await sync.startRun(later(1));

      expect(run).toMatchObject({ id: 'pedida-1', status: 'EN_CURSO' });
      expect(repo.runs.size).toBe(1);
    });

    it('otro error al crear la corrida no se oculta', async () => {
      jest
        .spyOn(repo, 'create')
        .mockRejectedValueOnce(new Error('se cayó la base'));

      await expect(sync.startRun(later(1))).rejects.toThrow('se cayó la base');
    });

    it('si otra ejecución del agente la tomó primero, responde 409 y no crea otra', async () => {
      await repo.create(SyncRun.request('pedida-1', ADMIN_ID, T0));
      jest
        .spyOn(repo, 'take')
        .mockRejectedValueOnce(new SyncRunAlreadyRunningError());

      await expect(sync.startRun(later(1))).rejects.toThrow(
        SyncRunAlreadyRunningError,
      );
      expect(repo.runs.size).toBe(1);
    });
  });

  describe('procesar una página', () => {
    it('guarda las carpetas de la página y suma sus resultados', async () => {
      const { id } = await sync.startRun(T0);

      const page = await sync.receivePage(
        { runId: id, pageNumber: 1, page: fixture('carpetas_notarias_p1') },
        later(1),
      );

      expect(page).toEqual({
        runId: id,
        pageNumber: 1,
        results: 50,
        folders: 50,
        filesCount: 50,
      });
      expect(repo.runs.get(id)?.lastActivityAt).toEqual(later(1));
      // Nothing becomes a material before the run closes
      expect(repo.materials.size).toBe(0);
    });

    it('una página reenviada con el mismo número reemplaza la anterior', async () => {
      const { id } = await sync.startRun(T0);
      const p1 = fixture('carpetas_notarias_p1');

      await sync.receivePage({ runId: id, pageNumber: 1, page: p1 }, later(1));
      const retried = await sync.receivePage(
        { runId: id, pageNumber: 1, page: p1 },
        later(2),
      );

      expect(retried.filesCount).toBe(50);
      expect(repo.pages.get(id)?.size).toBe(1);
    });

    it('los archivos cuentan como resultados pero no se guardan como carpetas', async () => {
      const { id } = await sync.startRun(T0);

      const page = await sync.receivePage(
        { runId: id, pageNumber: 1, page: fixture('archivos_de_una_hoja') },
        later(1),
      );

      expect(page).toMatchObject({ results: 3, folders: 0 });
    });

    it(`dada una página con más de ${MAX_RESULTS_PER_PAGE} resultados, responde 413 y no guarda nada`, async () => {
      const { id } = await sync.startRun(T0);
      const [result] = fixture('carpetas_notarias_p1').results;
      const page = {
        totalResults: MAX_RESULTS_PER_PAGE + 1,
        results: Array.from({ length: MAX_RESULTS_PER_PAGE + 1 }, (_, i) => ({
          ...result,
          name: `carpeta ${i}`,
        })),
      };

      await expect(
        sync.receivePage({ runId: id, pageNumber: 1, page }, later(1)),
      ).rejects.toThrow(EverythingPageTooLargeError);
      expect(repo.pages.get(id)?.size).toBe(0);
      expect(repo.runs.get(id)?.lastActivityAt).toEqual(T0);
    });

    it('dada una página sin la forma de Everything, la rechaza entera', async () => {
      const { id } = await sync.startRun(T0);

      await expect(
        sync.receivePage(
          { runId: id, pageNumber: 1, page: fixture('solo_archivos') },
          later(1),
        ),
      ).rejects.toThrow(InvalidEverythingPageError);
      expect(repo.pages.get(id)?.size).toBe(0);
    });

    it('responde 404 si la corrida no existe', async () => {
      await expect(
        sync.receivePage(
          {
            runId: 'no-existe',
            pageNumber: 1,
            page: fixture('sin_resultados'),
          },
          T0,
        ),
      ).rejects.toThrow(SyncRunNotFoundError);
    });

    it('responde 409 si la corrida ya terminó', async () => {
      const id = await sendPages([fixture('sin_resultados')]);
      await sync.closeRun(
        { runId: id, result: 'ERROR', errorMessage: 'x' },
        later(2),
      );

      await expect(
        sync.receivePage(
          { runId: id, pageNumber: 2, page: fixture('sin_resultados') },
          later(3),
        ),
      ).rejects.toThrow(SyncRunNotRunningError);
    });

    it('dada una corrida vencida, responde 409 y la cierra con error', async () => {
      const { id } = await sync.startRun(T0);

      await expect(
        sync.receivePage(
          { runId: id, pageNumber: 1, page: fixture('sin_resultados') },
          later(TIMEOUT + 1),
        ),
      ).rejects.toThrow(SyncRunExpiredError);
      expect(repo.runs.get(id)?.status).toBe('ERROR');
    });
  });

  describe('cerrar corrida completa', () => {
    it('cada carpeta hoja es un material con copia digital en la ruta de la carpeta', async () => {
      const id = await sendPages(fixturePages());

      const closed = await sync.closeRun(
        { runId: id, result: 'OK', pageCount: 4 },
        later(10),
      );

      expect(closed).toMatchObject({
        status: 'OK',
        filesCount: 124 + 6,
        errorMessage: null,
        summary: {
          leaves: EXPECTED_LEAVES.length,
          created: EXPECTED_LEAVES.length,
          updated: 0,
          notFound: 0,
          forReview: EXPECTED_LEAVES.filter((leaf) => leaf.needsReview).length,
        },
      });
      for (const leaf of EXPECTED_LEAVES) {
        expect(repo.materials.get(leaf.catalogCode)).toMatchObject({
          source: 'EVERYTHING',
          digitalPath: `${manifest.windowsRoot}\\${leaf.path}`,
          lastSeenAt: later(10),
          reviewReason: leaf.reviewReason,
          status: 'DISPONIBLE',
        });
      }
      expect(repo.materials.size).toBe(EXPECTED_LEAVES.length);
    });

    it('una carpeta con subcarpetas en otra página no es material', async () => {
      // The year 1930 of the second notary is in page 1 and its months in page 2
      const id = await sendPages(fixturePages());
      await sync.closeRun({ runId: id, result: 'OK', pageCount: 4 }, later(10));

      const paths = [...repo.materials.values()].map((m) => m.digitalPath);
      expect(paths).not.toContainEqual(
        expect.stringMatching(/\\1930 - Esc 1-0640 \(12\)$/),
      );
      expect(paths).not.toContainEqual(
        expect.stringMatching(/\\3ra - Notaria Tercera de Barranquilla[^\\]*$/),
      );
    });

    it('el mismo código en dos páginas deja las dos carpetas para revisión con el código de su ruta', async () => {
      const id = await sendPages(fixturePages());
      await sync.closeRun({ runId: id, result: 'OK', pageCount: 4 }, later(10));

      expect(repo.materials.get('NOT1-1940-0001-0161')).toBeUndefined();
      expect(repo.materials.get('NOT-F1082785')).toMatchObject({
        reviewReason: 'DUPLICATE_CODE',
      });
      expect(repo.materials.get('NOT-A07D63CC')).toMatchObject({
        reviewReason: 'DUPLICATE_CODE',
      });
    });

    it('una carpeta sin código válido usa el código de su ruta y queda para revisión', async () => {
      const id = await sendPages(fixturePages());
      await sync.closeRun({ runId: id, result: 'OK', pageCount: 4 }, later(10));

      expect(repo.materials.get('NOT-71F384CA')).toMatchObject({
        digitalPath: `${PRIMERA}\\1080`,
        reviewReason: 'NO_PATTERN',
      });
    });

    it('guarda los materiales de cada página en su propia transacción', async () => {
      const id = await sendPages(fixturePages());
      await sync.closeRun({ runId: id, result: 'OK', pageCount: 4 }, later(10));

      expect(repo.savedGroups).toHaveLength(4);
      const pages = fixturePages();
      repo.savedGroups.forEach((group, index) => {
        const folders = new Set(
          pages[index].results.map((r) => `${r.path}\\${r.name}`),
        );
        expect(group.every((m) => folders.has(m.digitalPath))).toBe(true);
      });
    });

    it('actualiza el material que ya existe por su código, sin tocar su estado', async () => {
      repo.addMaterial({
        catalogCode: 'NOT1-1931-0001-0109',
        status: 'EN_RESTAURACION',
        author: 'Notario',
        digitalPath: `${ENE_1931} (copia vieja)`,
      });
      const id = await sendPages(fixturePages());

      const closed = await sync.closeRun(
        { runId: id, result: 'OK', pageCount: 4 },
        later(10),
      );

      expect(closed.summary).toMatchObject({
        created: EXPECTED_LEAVES.length - 1,
        updated: 1,
      });
      expect(repo.materials.get('NOT1-1931-0001-0109')).toMatchObject({
        id: 'seed-NOT1-1931-0001-0109',
        status: 'EN_RESTAURACION',
        author: 'Notario',
        digitalPath: ENE_1931,
        title:
          'Notaría Primera de Barranquilla · 1931 · Escrituras 1–109 (enero)',
      });
    });

    it('dada una carpeta renombrada con el mismo código, actualiza el mismo material y no crea otro', async () => {
      const first = await sendPages(fixturePages());
      await sync.closeRun(
        { runId: first, result: 'OK', pageCount: 4 },
        later(10),
      );
      const before = repo.materials.get('NOT1-1931-0001-0109')!;
      const renamed = fixturePages().map((page) => ({
        ...page,
        results: page.results.map((result) =>
          result.name === '1ra-1931 - Esc 0001-0109 - Ene'
            ? { ...result, name: '1ra-1931 - Esc 1-109 - Ene' }
            : result,
        ),
      }));

      const second = await sendPages(renamed, later(60));
      const closed = await sync.closeRun(
        { runId: second, result: 'OK', pageCount: 4 },
        later(70),
      );

      expect(closed.summary).toMatchObject({ created: 0, notFound: 0 });
      expect(repo.materials.size).toBe(EXPECTED_LEAVES.length);
      expect(repo.materials.get('NOT1-1931-0001-0109')).toMatchObject({
        id: before.id,
        digitalPath: `${PRIMERA}\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 1-109 - Ene`,
      });
    });

    it('marca «copia digital no encontrada» los materiales de Everything que no aparecieron, sin borrarlos', async () => {
      repo.addMaterial({
        catalogCode: 'NOT4-1956-0001-0180',
        digitalPath: `${BASE}\\Aha\\Fondo - Notarías\\Notarías\\4ta\\1956\\Ene`,
      });
      repo.addMaterial({
        catalogCode: 'MAN-0001',
        source: 'MANUAL',
        digitalPath: 'D:\\Digitalizados\\manual',
      });
      repo.addMaterial({
        catalogCode: 'NOT9-1999-0001-0002',
        digitalPath: null,
      });
      const id = await sendPages(fixturePages());

      const closed = await sync.closeRun(
        { runId: id, result: 'OK', pageCount: 4 },
        later(10),
      );

      expect(closed.summary?.notFound).toBe(1);
      expect(repo.materials.get('NOT4-1956-0001-0180')).toMatchObject({
        digitalPath: null,
        lastSeenAt: new Date('2026-11-01T00:00:00.000Z'),
      });
      // A MANUAL material is not from Everything
      expect(repo.materials.get('MAN-0001')?.digitalPath).toBe(
        'D:\\Digitalizados\\manual',
      );
      expect(repo.materials.has('NOT9-1999-0001-0002')).toBe(true);
    });

    it('deja la corrida OK y borra sus páginas', async () => {
      const id = await sendPages(fixturePages());
      await sync.closeRun({ runId: id, result: 'OK', pageCount: 4 }, later(10));

      expect(repo.runs.get(id)).toMatchObject({
        status: 'OK',
        finishedAt: later(10),
      });
      expect(repo.pages.get(id)?.size).toBe(0);
    });
  });

  describe('cerrar corrida que no está completa', () => {
    beforeEach(() => {
      repo.addMaterial({
        catalogCode: 'NOT4-1956-0001-0180',
        digitalPath: `${BASE}\\vieja`,
      });
    });

    const expectNothingChanged = () => {
      expect(repo.savedGroups).toEqual([]);
      expect(repo.materials.size).toBe(1);
      expect(repo.materials.get('NOT4-1956-0001-0180')?.digitalPath).toBe(
        `${BASE}\\vieja`,
      );
    };

    it('cerrada con error, no cambia ningún material ni marca nada', async () => {
      const id = await sendPages(fixturePages().slice(0, 2));

      const closed = await sync.closeRun(
        { runId: id, result: 'ERROR', errorMessage: 'Everything no respondió' },
        later(10),
      );

      expect(closed).toMatchObject({
        status: 'ERROR',
        errorMessage: 'Everything no respondió',
        summary: null,
      });
      expectNothingChanged();
    });

    it('cortada a la mitad (faltan páginas), termina con error y no marca nada', async () => {
      const id = await sendPages(fixturePages().slice(0, 2));

      const closed = await sync.closeRun(
        { runId: id, result: 'OK', pageCount: 4 },
        later(10),
      );

      expect(closed.status).toBe('ERROR');
      expect(closed.errorMessage).toContain('faltan las páginas 3, 4');
      expectNothingChanged();
    });

    it('con páginas de más de las que contó el agente, termina con error', async () => {
      const id = await sendPages(fixturePages());

      const closed = await sync.closeRun(
        { runId: id, result: 'OK', pageCount: 3 },
        later(10),
      );

      expect(closed.status).toBe('ERROR');
      expect(closed.errorMessage).toContain('sobra la página 4');
      expectNothingChanged();
    });

    it('sin ninguna carpeta hoja (Everything no ve la unidad), termina con error y no marca nada', async () => {
      const id = await sendPages([fixture('sin_resultados')]);

      const closed = await sync.closeRun(
        { runId: id, result: 'OK', pageCount: 1 },
        later(10),
      );

      expect(closed.status).toBe('ERROR');
      expect(closed.errorMessage).toContain('ninguna carpeta hoja');
      expectNothingChanged();
    });

    it('si falla al guardar los materiales, termina con error, no marca nada y avisa del fallo', async () => {
      const id = await sendPages(fixturePages());
      repo.failSavingMaterials = new Error('se cayó la base');

      await expect(
        sync.closeRun({ runId: id, result: 'OK', pageCount: 4 }, later(10)),
      ).rejects.toThrow('se cayó la base');

      expect(repo.runs.get(id)).toMatchObject({ status: 'ERROR' });
      expect(repo.runs.get(id)?.errorMessage).toContain('se cayó la base');
      expect(repo.materials.get('NOT4-1956-0001-0180')?.digitalPath).toBe(
        `${BASE}\\vieja`,
      );
    });

    it('responde 409 si la corrida ya terminó', async () => {
      const id = await sendPages([fixture('carpetas_periodicos')]);
      await sync.closeRun({ runId: id, result: 'OK', pageCount: 1 }, later(5));

      await expect(
        sync.closeRun({ runId: id, result: 'OK', pageCount: 1 }, later(6)),
      ).rejects.toThrow(SyncRunNotRunningError);
    });

    it('dada una corrida vencida, responde 409 y no marca nada', async () => {
      const id = await sendPages(fixturePages());

      await expect(
        sync.closeRun(
          { runId: id, result: 'OK', pageCount: 4 },
          later(4 + TIMEOUT + 1),
        ),
      ).rejects.toThrow(SyncRunExpiredError);
      expect(repo.runs.get(id)?.status).toBe('ERROR');
      expectNothingChanged();
    });
  });
});
