import { randomBytes, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import {
  API,
  E2eApp,
  Session,
  bearer,
  createE2eApp,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

interface RunBody {
  id: string;
  status: string;
  filesCount: number;
  errorMessage: string | null;
  summary?: {
    leaves: number;
    created: number;
    updated: number;
    notFound: number;
    forReview: number;
  } | null;
}

interface ManifestLeaf {
  path: string;
  catalogCode: string;
  collection: string;
  reviewReason: string | null;
}

// Real answers of Everything and the manifest of the simulated tree (HU-133)
const DEV = join(__dirname, '..', '..', '..', 'dev');
const fixture = (id: string): string =>
  readFileSync(join(DEV, 'fixtures', `everything_${id}.json`), 'utf8');
const manifest = JSON.parse(
  readFileSync(join(DEV, 'manifiesto.json'), 'utf8'),
) as { windowsRoot: string; leaves: ManifestLeaf[] };

// What the agent sends in a run: the notaries in three pages and the
// periodicals in one, as Everything answered them (CRLF and tabs included)
const PAGES = [
  'carpetas_notarias_p1',
  'carpetas_notarias_p2',
  'carpetas_notarias_p3',
  'carpetas_periodicos',
].map(fixture);
// Every leaf of those pages: the manifest without Correspondencia, which has
// no fixture
const LEAVES = manifest.leaves.filter(
  (leaf) => leaf.collection !== 'Correspondencia',
);
const LEAF_CODES = LEAVES.map((leaf) => leaf.catalogCode);
const pathOf = (leaf: ManifestLeaf) => `${manifest.windowsRoot}\\${leaf.path}`;

const NOTARIES = `${manifest.windowsRoot}\\Aha\\Fondo - Notarías\\Notarías`;
const PRIMERA = `${NOTARIES}\\1ra - Notaria Primera de Barranquilla - 1815 a 1979`;
const YEAR_1931 = `${PRIMERA}\\1931 - Esc 1-1290 (12) +`;
const ENE_1931 = `${YEAR_1931}\\1ra-1931 - Esc 0001-0109 - Ene`;
// A year whose months come in the next page: it is not a leaf
const YEAR_1930 = `${NOTARIES}\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1930 - Esc 1-0640 (12)`;
// In the seed, but not in the tree: its folder no longer appears (HU-165)
const NOT_IN_TREE = 'NOT4-1956-0001-0180';

/**
 * Sync with Everything, HU-137 (e2e, PostgreSQL). The agent (HU-166) sends
 * the real pages of the fixtures of HU-133 to the ingest endpoints with its
 * own token: a complete run, a renamed folder, a run cut in the middle that
 * marks nothing, and calls without the token that save nothing. Each run
 * stays in sync_runs with its result.
 */
describe('Everything sync, HU-137 (e2e, PostgreSQL)', () => {
  const TOKEN = randomBytes(32).toString('hex');
  let e2e: E2eApp;
  let staff: Session;
  let requester: Session;

  const agent = (test: request.Test, token = TOKEN) =>
    test.set('Authorization', `Bearer ${token}`);
  const start = (token?: string) =>
    agent(request(e2e.server).post(`${API}/everything/sync-runs`), token);
  const sendPage = (runId: string, number: number, page: string) =>
    agent(
      request(e2e.server)
        .put(`${API}/everything/sync-runs/${runId}/pages/${number}`)
        .set('Content-Type', 'application/json'),
    ).send(page);
  const close = (runId: string, body: Record<string, unknown>) =>
    agent(
      request(e2e.server).post(`${API}/everything/sync-runs/${runId}/close`),
    ).send(body);

  /** A whole run: start, every page and the close as complete. */
  const runComplete = async (pages: string[] = PAGES) => {
    const started = await start().expect(201);
    const { id } = started.body as RunBody;
    for (const [index, page] of pages.entries()) {
      await sendPage(id, index + 1, page).expect(200);
    }
    const closed = await close(id, { result: 'OK', pageCount: pages.length });
    expect(closed.status).toBe(200);
    return closed.body as RunBody;
  };

  const materialByCode = (catalogCode: string) =>
    e2e.prisma.materialModel.findUnique({ where: { catalogCode } });

  /** What a call that must be rejected could have written. */
  const counts = async () => ({
    runs: await e2e.prisma.syncRunModel.count(),
    pages: await e2e.prisma.syncRunPageModel.count(),
    materials: await e2e.prisma.materialModel.count(),
  });

  /**
   * A run other files or tests left open, or waiting for the agent (HU-138),
   * would answer 409 or be taken by the start.
   */
  const endOpenRuns = async () => {
    await e2e.prisma.syncRunModel.deleteMany({ where: { status: 'PEDIDA' } });
    await e2e.prisma.syncRunModel.updateMany({
      where: { status: 'EN_CURSO' },
      data: {
        status: 'ERROR',
        finishedAt: new Date(),
        errorMessage: 'Cerrada por la prueba e2e de HU-137',
      },
    });
    await e2e.prisma.syncRunPageModel.deleteMany({});
  };

  /** A material as the sync left it in an earlier run (HU-165). */
  const createSyncedMaterial = async (
    catalogCode: string,
    digitalPath: string | null,
    extra: { status?: string; source?: string } = {},
  ) => {
    const id = randomUUID();
    await e2e.prisma.materialModel.create({
      data: {
        id,
        catalogCode,
        title: `Material ${catalogCode}`,
        materialType: 'PROTOCOLO_NOTARIAL',
        collection: 'Notarías',
        status: extra.status ?? 'DISPONIBLE',
        source: extra.source ?? 'EVERYTHING',
        digitalPath,
        lastSeenAt: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    return id;
  };

  beforeAll(async () => {
    process.env.EVERYTHING_AGENT_TOKEN = TOKEN;
    process.env.EVERYTHING_RUN_TIMEOUT_MINUTES = '30';
    e2e = await createE2eApp();
    staff = await signInStaffUser(e2e);
    requester = await signUpPublicUser(e2e.server, 'everything');
  });

  beforeEach(endOpenRuns);

  afterAll(async () => {
    await endOpenRuns();
    await e2e.app.close();
  });

  describe('without the agent token', () => {
    it.each([
      ['no Authorization header', null],
      ['a wrong token', randomBytes(32).toString('hex')],
    ])('answers 401 with %s and saves nothing', async (_case, token) => {
      const before = await counts();
      const send = (test: request.Test) =>
        token ? test.set('Authorization', `Bearer ${token}`) : test;
      const runId = randomUUID();

      const responses = [
        await send(request(e2e.server).post(`${API}/everything/sync-runs`)),
        await send(
          request(e2e.server)
            .put(`${API}/everything/sync-runs/${runId}/pages/1`)
            .set('Content-Type', 'application/json'),
        ).send(PAGES[0]),
        await send(
          request(e2e.server).post(
            `${API}/everything/sync-runs/${runId}/close`,
          ),
        ).send({ result: 'OK', pageCount: 1 }),
      ];

      for (const response of responses) {
        expect(response.status).toBe(401);
        expect((response.body as ErrorBody).code).toBe('INVALID_AGENT_TOKEN');
      }
      expect(await counts()).toEqual(before);
    });

    it('does not take the session of a user: a staff access token gets 401', async () => {
      const before = await counts();

      const response = await request(e2e.server)
        .post(`${API}/everything/sync-runs`)
        .set('Authorization', bearer(staff))
        .expect(401);

      expect((response.body as ErrorBody).code).toBe('INVALID_AGENT_TOKEN');
      expect(await counts()).toEqual(before);
    });
  });

  describe('without EVERYTHING_AGENT_TOKEN in the backend', () => {
    it('answers 503 to every ingest endpoint and accepts nothing', async () => {
      delete process.env.EVERYTHING_AGENT_TOKEN;
      const disabled = await createE2eApp();
      process.env.EVERYTHING_AGENT_TOKEN = TOKEN;
      try {
        const before = await counts();
        const runId = randomUUID();

        const responses = [
          await agent(
            request(disabled.server).post(`${API}/everything/sync-runs`),
          ),
          await agent(
            request(disabled.server)
              .put(`${API}/everything/sync-runs/${runId}/pages/1`)
              .set('Content-Type', 'application/json'),
          ).send(PAGES[0]),
          await agent(
            request(disabled.server).post(
              `${API}/everything/sync-runs/${runId}/close`,
            ),
          ).send({ result: 'OK', pageCount: 1 }),
        ];

        for (const response of responses) {
          expect(response.status).toBe(503);
          expect((response.body as ErrorBody).code).toBe(
            'EVERYTHING_SYNC_DISABLED',
          );
        }
        expect(await counts()).toEqual(before);
      } finally {
        await disabled.app.close();
      }
    });
  });

  describe('a complete run', () => {
    let notInTreeId: string;
    let existingId: string;
    let manualId: string;
    let digitalRequestId: string;
    let run: RunBody;

    beforeAll(async () => {
      await endOpenRuns();
      // HU-138 may already have imported the same static tree in another file.
      // Keep its rows/foreign keys, but free this fixture's codes so the
      // expected one update + N creations does not depend on test order.
      const previous = await e2e.prisma.materialModel.findMany({
        where: { catalogCode: { in: LEAF_CODES } },
        select: { id: true },
      });
      for (const material of previous) {
        await e2e.prisma.materialModel.update({
          where: { id: material.id },
          data: { catalogCode: `E2E-${randomUUID().toUpperCase()}` },
        });
      }
      // Already synced before: it keeps its id and its status
      existingId = await createSyncedMaterial(
        'NOT1-1931-0001-0109',
        `${ENE_1931} (copia de antes)`,
        { status: 'EN_RESTAURACION' },
      );
      // Its folder is no longer there, and a request asks for it
      notInTreeId = await createSyncedMaterial(
        NOT_IN_TREE,
        `${NOTARIES}\\4ta - Notaria Cuarta de Barranquilla - 1950 a 1960 (12)\\1956 - Esc 1-2400 (12)\\4ta-1956 - Esc 0001-0180 - Ene`,
      );
      manualId = await createSyncedMaterial(
        `E2E-MAN-${randomUUID().slice(0, 8).toUpperCase()}`,
        'D:\\Digitalizados\\manual',
        { source: 'MANUAL' },
      );
      ({ id: digitalRequestId } = await submitRequest(
        e2e.server,
        requester,
        [notInTreeId],
        'DIGITAL',
      ));

      run = await runComplete();
    });

    it('closes OK and stays in sync_runs with its result, without its pages', async () => {
      expect(run).toMatchObject({
        status: 'OK',
        filesCount: 124 + 6,
        errorMessage: null,
        summary: {
          leaves: LEAVES.length,
          created: LEAVES.length - 1,
          updated: 1,
          forReview: LEAVES.filter((leaf) => leaf.reviewReason).length,
        },
      });
      const stored = await e2e.prisma.syncRunModel.findUniqueOrThrow({
        where: { id: run.id },
      });
      expect(stored).toMatchObject({
        status: 'OK',
        filesCount: 130,
        errorMessage: null,
      });
      expect(stored.finishedAt).toBeInstanceOf(Date);
      expect(
        await e2e.prisma.syncRunPageModel.count({
          where: { syncRunId: run.id },
        }),
      ).toBe(0);
    });

    it('turns each leaf folder into a material from Everything with its folder as digital copy', async () => {
      const materials = await e2e.prisma.materialModel.findMany({
        where: { catalogCode: { in: LEAF_CODES } },
      });

      expect(materials).toHaveLength(LEAVES.length);
      const byCode = new Map(materials.map((m) => [m.catalogCode, m]));
      for (const leaf of LEAVES) {
        expect(byCode.get(leaf.catalogCode)).toMatchObject({
          source: 'EVERYTHING',
          digitalPath: pathOf(leaf),
          reviewReason: leaf.reviewReason,
        });
        expect(byCode.get(leaf.catalogCode)?.lastSeenAt).toBeInstanceOf(Date);
      }
      // A year whose months came in the next page is not a material
      expect(
        await e2e.prisma.materialModel.count({
          where: { digitalPath: YEAR_1930 },
        }),
      ).toBe(0);
    });

    it('leaves a folder without a valid code, or with a repeated one, for review with the code of its path', async () => {
      expect(await materialByCode('NOT-71F384CA')).toMatchObject({
        digitalPath: `${PRIMERA}\\1080`,
        reviewReason: 'NO_PATTERN',
      });
      // The same code in two folders, each one in a different page
      expect(await materialByCode('NOT1-1940-0001-0161')).toBeNull();
      expect(await materialByCode('NOT-F1082785')).toMatchObject({
        reviewReason: 'DUPLICATE_CODE',
      });
      expect(await materialByCode('NOT-A07D63CC')).toMatchObject({
        reviewReason: 'DUPLICATE_CODE',
      });
    });

    it('updates the material that already had the code instead of creating another one', async () => {
      expect(await materialByCode('NOT1-1931-0001-0109')).toMatchObject({
        id: existingId,
        status: 'EN_RESTAURACION',
        digitalPath: ENE_1931,
        title:
          'Notaría Primera de Barranquilla · 1931 · Escrituras 1–109 (enero)',
      });
    });

    it('marks «copia digital no encontrada» the Everything material that did not appear, without deleting it', async () => {
      expect(run.summary?.notFound).toBeGreaterThanOrEqual(1);
      const notInTree = await e2e.prisma.materialModel.findUniqueOrThrow({
        where: { id: notInTreeId },
        include: { requestItems: true },
      });
      expect(notInTree.digitalPath).toBeNull();
      expect(notInTree.lastSeenAt).toEqual(
        new Date('2026-11-01T00:00:00.000Z'),
      );
      expect(notInTree.requestItems).toHaveLength(1);

      // Without its copy, the digital request goes through the search again (HU-139)
      const detail = await request(e2e.server)
        .get(`${API}/requests/${digitalRequestId}`)
        .set('Authorization', bearer(staff))
        .expect(200);
      const body = detail.body as {
        allowedTransitions: string[];
        materials: { hasDigitalCopy: boolean }[];
      };
      expect(body.materials[0].hasDigitalCopy).toBe(false);
      expect(body.allowedTransitions).not.toContain('DISPONIBLE');
    });

    it('never touches a material that does not come from Everything', async () => {
      expect(
        await e2e.prisma.materialModel.findUniqueOrThrow({
          where: { id: manualId },
        }),
      ).toMatchObject({
        source: 'MANUAL',
        digitalPath: 'D:\\Digitalizados\\manual',
      });
    });
  });

  describe('a renamed folder', () => {
    it('updates the same material when the folder keeps its code, and creates no other', async () => {
      const before = await materialByCode('NOT1-1931-0001-0109');
      const renamedP1 = PAGES[0].replace(
        '"name":"1ra-1931 - Esc 0001-0109 - Ene"',
        '"name":"1ra-1931 - Esc 1-109 - Ene"',
      );
      expect(renamedP1).not.toBe(PAGES[0]);

      const run = await runComplete([renamedP1, ...PAGES.slice(1)]);

      expect(run.status).toBe('OK');
      expect(run.summary?.created).toBe(0);
      expect(await materialByCode('NOT1-1931-0001-0109')).toMatchObject({
        id: before?.id,
        digitalPath: `${YEAR_1931}\\1ra-1931 - Esc 1-109 - Ene`,
      });
      expect(
        await e2e.prisma.materialModel.count({
          where: { catalogCode: { in: LEAF_CODES } },
        }),
      ).toBe(LEAVES.length);
    });
  });

  describe('a run cut in the middle', () => {
    // A periodical that only comes in page 4
    const PERIODICAL = LEAVES.find((leaf) => leaf.collection === 'Periódicos')!;

    const copyOfPeriodical = async () =>
      (await materialByCode(PERIODICAL.catalogCode))?.digitalPath;

    it('that the agent stopped sending expires when another run starts, and marks nothing as not found', async () => {
      const seenBefore = (await materialByCode(PERIODICAL.catalogCode))
        ?.lastSeenAt;
      const cut = (await start().expect(201)).body as RunBody;
      await sendPage(cut.id, 1, PAGES[0]).expect(200);
      // The agent closed or lost the connection more than 30 minutes ago
      await e2e.prisma.syncRunModel.update({
        where: { id: cut.id },
        data: { lastActivityAt: new Date(Date.now() - 31 * 60_000) },
      });

      const next = await start().expect(201);

      const expired = await e2e.prisma.syncRunModel.findUniqueOrThrow({
        where: { id: cut.id },
      });
      expect(expired.status).toBe('ERROR');
      expect(expired.errorMessage).toContain('venció');
      expect(
        await e2e.prisma.syncRunPageModel.count({
          where: { syncRunId: cut.id },
        }),
      ).toBe(0);
      expect(await copyOfPeriodical()).toBe(pathOf(PERIODICAL));
      expect(
        (await materialByCode(PERIODICAL.catalogCode))?.lastSeenAt,
      ).toEqual(seenBefore);
      await close((next.body as RunBody).id, {
        result: 'ERROR',
        errorMessage: 'Fin de la prueba',
      }).expect(200);
    });

    it('that the agent closes as complete without every page ends with an error and marks nothing', async () => {
      const cut = (await start().expect(201)).body as RunBody;
      await sendPage(cut.id, 1, PAGES[0]).expect(200);
      await sendPage(cut.id, 2, PAGES[1]).expect(200);

      const closed = await close(cut.id, { result: 'OK', pageCount: 4 }).expect(
        200,
      );

      expect(closed.body).toMatchObject({
        status: 'ERROR',
        summary: null,
      });
      expect((closed.body as RunBody).errorMessage).toContain(
        'faltan las páginas 3, 4',
      );
      expect(await copyOfPeriodical()).toBe(pathOf(PERIODICAL));
    });

    it('that the agent closes with an error marks nothing and keeps its reason', async () => {
      const cut = (await start().expect(201)).body as RunBody;
      await sendPage(cut.id, 1, PAGES[0]).expect(200);

      await close(cut.id, {
        result: 'ERROR',
        errorMessage: 'Everything no respondió en 30 s',
      }).expect(200);

      expect(
        await e2e.prisma.syncRunModel.findUniqueOrThrow({
          where: { id: cut.id },
        }),
      ).toMatchObject({
        status: 'ERROR',
        errorMessage: 'Everything no respondió en 30 s',
        filesCount: 50,
      });
      expect(await copyOfPeriodical()).toBe(pathOf(PERIODICAL));
    });
  });

  describe('two syncs at once', () => {
    it('answers 409 to a second start while a run is open, even from two instances at the same time', async () => {
      const [first, second] = await Promise.all([start(), start()]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      const rejected = first.status === 409 ? first : second;
      expect((rejected.body as ErrorBody).code).toBe(
        'SYNC_RUN_ALREADY_RUNNING',
      );
      await start().expect(409);
      expect(
        await e2e.prisma.syncRunModel.count({ where: { status: 'EN_CURSO' } }),
      ).toBe(1);
    });
  });

  describe('a page the backend cannot take', () => {
    let runId: string;

    beforeEach(async () => {
      runId = ((await start().expect(201)).body as RunBody).id;
    });

    const expectNothingSaved = async () => {
      expect(
        await e2e.prisma.syncRunPageModel.count({
          where: { syncRunId: runId },
        }),
      ).toBe(0);
      expect(
        await e2e.prisma.syncRunModel.findUniqueOrThrow({
          where: { id: runId },
        }),
      ).toMatchObject({ status: 'EN_CURSO', filesCount: 0 });
    };

    it('answers 413 to more results than the limit and saves nothing', async () => {
      const results = Array.from({ length: 501 }, (_, i) => ({
        type: 'folder',
        name: `Carpeta ${i}`,
        path: NOTARIES,
        size: '',
        date_modified: '134396687063866479',
      }));

      const response = await sendPage(
        runId,
        1,
        JSON.stringify({ totalResults: 501, results }),
      ).expect(413);

      expect((response.body as ErrorBody).code).toBe(
        'EVERYTHING_PAGE_TOO_LARGE',
      );
      await expectNothingSaved();
    });

    it('answers 413 to a body above 100 kB and saves nothing', async () => {
      const results = Array.from({ length: 200 }, (_, i) => ({
        type: 'folder',
        name: `${'Carpeta con un nombre muy largo '.repeat(20)}${i}`,
        path: NOTARIES,
        size: '',
        date_modified: '134396687063866479',
      }));
      const body = JSON.stringify({ totalResults: 200, results });
      expect(Buffer.byteLength(body)).toBeGreaterThan(100 * 1024);

      const response = await sendPage(runId, 1, body).expect(413);

      expect((response.body as ErrorBody).code).toBe('PAYLOAD_TOO_LARGE');
      await expectNothingSaved();
    });

    it('answers 400 to a page without the shape of Everything and saves nothing', async () => {
      const response = await sendPage(
        runId,
        1,
        fixture('solo_archivos'),
      ).expect(400);

      expect((response.body as ErrorBody).code).toBe('INVALID_EVERYTHING_PAGE');
      await expectNothingSaved();
    });

    it('answers 404 to a page of a run that does not exist', async () => {
      const response = await sendPage(randomUUID(), 1, PAGES[3]).expect(404);

      expect((response.body as ErrorBody).code).toBe('SYNC_RUN_NOT_FOUND');
    });
  });
});
