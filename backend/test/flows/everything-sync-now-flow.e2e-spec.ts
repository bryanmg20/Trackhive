import { randomBytes } from 'crypto';
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
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

interface RunBody {
  id: string;
  status: string;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  filesCount: number;
  errorMessage: string | null;
}

interface StatusBody {
  enabled: boolean;
  currentRun: (RunBody & { expired: boolean }) | null;
  lastRun: RunBody | null;
  agentLastContactAt: string | null;
}

// Real answers of Everything (HU-133): the notaries in three pages and the
// periodicals in one, as the agent sends them
const DEV = join(__dirname, '..', '..', '..', 'dev');
const PAGES = [
  'carpetas_notarias_p1',
  'carpetas_notarias_p2',
  'carpetas_notarias_p3',
  'carpetas_periodicos',
].map((id) =>
  readFileSync(join(DEV, 'fixtures', `everything_${id}.json`), 'utf8'),
);

/**
 * «Sincronizar ahora» and the state of the sync, HU-138 (e2e, PostgreSQL).
 * An administrator asks for a run, which waits PEDIDA; the agent asks with
 * its token whether one is requested, takes it when it starts the sync and
 * closes it; the screen then shows the new result and the last contact of
 * the agent. PERSONAL and PUBLICO get 403 and nothing is saved.
 */
describe('Sincronizar ahora, HU-138 (e2e, PostgreSQL)', () => {
  const TOKEN = randomBytes(32).toString('hex');
  let e2e: E2eApp;
  let admin: Session;
  let staff: Session;
  let publicUser: Session;

  const status = (session: Session = admin) =>
    request(e2e.server)
      .get(`${API}/everything/sync-status`)
      .set('Authorization', bearer(session));
  const requestSync = (session: Session = admin) =>
    request(e2e.server)
      .post(`${API}/everything/sync-requests`)
      .set('Authorization', bearer(session));

  // The agent, with its token
  const agent = (test: request.Test, token = TOKEN) =>
    test.set('Authorization', `Bearer ${token}`);
  const agentAsks = (token?: string) =>
    agent(
      request(e2e.server).get(`${API}/everything/sync-runs/requested`),
      token,
    );
  const agentStarts = () =>
    agent(request(e2e.server).post(`${API}/everything/sync-runs`));
  const agentSends = (runId: string, number: number, page: string) =>
    agent(
      request(e2e.server)
        .put(`${API}/everything/sync-runs/${runId}/pages/${number}`)
        .set('Content-Type', 'application/json'),
    ).send(page);
  const agentCloses = (runId: string, body: Record<string, unknown>) =>
    agent(
      request(e2e.server).post(`${API}/everything/sync-runs/${runId}/close`),
    ).send(body);

  const openRuns = () =>
    e2e.prisma.syncRunModel.findMany({
      where: { status: { in: ['PEDIDA', 'EN_CURSO'] } },
    });
  const lastContact = async () =>
    (await e2e.prisma.syncAgentModel.findUnique({ where: { id: 1 } }))
      ?.lastContactAt ?? null;

  /** Runs other files or tests left waiting or open would answer 409. */
  const endOpenRuns = async () => {
    await e2e.prisma.syncRunModel.deleteMany({ where: { status: 'PEDIDA' } });
    await e2e.prisma.syncRunModel.updateMany({
      where: { status: 'EN_CURSO' },
      data: {
        status: 'ERROR',
        finishedAt: new Date(),
        errorMessage: 'Cerrada por la prueba e2e de HU-138',
      },
    });
    await e2e.prisma.syncRunPageModel.deleteMany({});
  };

  beforeAll(async () => {
    process.env.EVERYTHING_AGENT_TOKEN = TOKEN;
    process.env.EVERYTHING_RUN_TIMEOUT_MINUTES = '30';
    e2e = await createE2eApp();
    admin = await signInStaffUser(e2e, 'ADMIN');
    staff = await signInStaffUser(e2e, 'PERSONAL');
    publicUser = await signUpPublicUser(e2e.server, 'sincronizar');
  });

  beforeEach(endOpenRuns);

  afterAll(async () => {
    await endOpenRuns();
    await e2e.app.close();
  });

  describe('only for ADMIN (HU-04)', () => {
    it.each([
      ['PERSONAL', () => staff],
      ['PUBLICO', () => publicUser],
    ])(
      'answers 403 to %s on both endpoints and asks for nothing',
      async (_role, session) => {
        const before = await e2e.prisma.syncRunModel.count();

        const responses = [
          await status(session()),
          await requestSync(session()),
        ];

        for (const response of responses) {
          expect(response.status).toBe(403);
          expect((response.body as ErrorBody).code).toBe('FORBIDDEN');
        }
        expect(await e2e.prisma.syncRunModel.count()).toBe(before);
      },
    );

    it('answers 401 without a session, and the token of the agent is not one', async () => {
      await request(e2e.server)
        .get(`${API}/everything/sync-status`)
        .expect(401);
      await request(e2e.server)
        .post(`${API}/everything/sync-requests`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .expect(401);
      expect(await openRuns()).toHaveLength(0);
    });
  });

  describe('«Sincronizar ahora» and the agent', () => {
    it('leaves a run PEDIDA, the agent takes it and closes it, and the state shows the new result', async () => {
      // Nothing asked for yet
      const idle = (await status().expect(200)).body as StatusBody;
      expect(idle).toMatchObject({ enabled: true, currentRun: null });
      expect((await agentAsks().expect(200)).body).toEqual({
        requested: false,
        requestedAt: null,
      });

      // The administrator confirms «Sincronizar ahora»
      const asked = (await requestSync().expect(201)).body as RunBody;
      expect(asked).toMatchObject({
        status: 'PEDIDA',
        startedAt: null,
        finishedAt: null,
        filesCount: 0,
      });
      expect(
        await e2e.prisma.syncRunModel.findUniqueOrThrow({
          where: { id: asked.id },
        }),
      ).toMatchObject({
        status: 'PEDIDA',
        requestedById: admin.userId,
        startedAt: null,
      });

      // The screen shows it «pedida, esperando al agente», and since when
      const waiting = (await status().expect(200)).body as StatusBody;
      expect(waiting.currentRun).toMatchObject({
        id: asked.id,
        status: 'PEDIDA',
        requestedAt: asked.requestedAt,
        expired: false,
      });

      // Pressing again asks for no other one, and says why
      const again = await requestSync().expect(409);
      expect((again.body as ErrorBody).code).toBe('SYNC_RUN_ALREADY_REQUESTED');
      expect(await openRuns()).toHaveLength(1);

      // The agent asks with its token: there is one, and its contact stays
      const asking = new Date();
      expect((await agentAsks().expect(200)).body).toEqual({
        requested: true,
        requestedAt: asked.requestedAt,
      });
      expect((await lastContact())!.getTime()).toBeGreaterThanOrEqual(
        asking.getTime() - 1000,
      );

      // It starts the sync: that takes the same run
      const started = (await agentStarts().expect(201)).body as RunBody;
      expect(started).toMatchObject({
        id: asked.id,
        status: 'EN_CURSO',
        requestedAt: asked.requestedAt,
      });
      expect(started.startedAt).not.toBeNull();
      expect((await agentAsks().expect(200)).body).toMatchObject({
        requested: false,
      });

      // While it runs, pressing again asks for no other one either
      const running = await requestSync().expect(409);
      expect((running.body as ErrorBody).code).toBe('SYNC_RUN_ALREADY_RUNNING');
      expect(
        ((await status().expect(200)).body as StatusBody).currentRun,
      ).toMatchObject({ id: asked.id, status: 'EN_CURSO', expired: false });

      // It sends every page and closes the run complete
      for (const [index, page] of PAGES.entries()) {
        await agentSends(asked.id, index + 1, page).expect(200);
      }
      await agentCloses(asked.id, { result: 'OK', pageCount: PAGES.length })
        .expect(200)
        .expect(({ body }) => expect((body as RunBody).status).toBe('OK'));

      // The screen shows the new result: when, how many folders, OK
      const done = (await status().expect(200)).body as StatusBody;
      expect(done.currentRun).toBeNull();
      expect(done.lastRun).toMatchObject({
        id: asked.id,
        status: 'OK',
        requestedAt: asked.requestedAt,
        filesCount: 124 + 6,
        errorMessage: null,
      });
      expect(done.lastRun?.finishedAt).not.toBeNull();
      expect(done.agentLastContactAt).not.toBeNull();
    });

    it('shows a run that ended with an error with its reason', async () => {
      await requestSync().expect(201);
      const run = (await agentStarts().expect(201)).body as RunBody;
      await agentCloses(run.id, {
        result: 'ERROR',
        errorMessage: 'Everything no responde en http://127.0.0.1:8081',
      }).expect(200);

      expect(
        ((await status().expect(200)).body as StatusBody).lastRun,
      ).toMatchObject({
        id: run.id,
        status: 'ERROR',
        errorMessage: 'Everything no responde en http://127.0.0.1:8081',
      });
    });

    it('keeps the run PEDIDA however long the agent takes (the PC of the CLENA is off), and the state says since when', async () => {
      const asked = (await requestSync().expect(201)).body as RunBody;
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000);
      await e2e.prisma.syncRunModel.update({
        where: { id: asked.id },
        data: { requestedAt: threeDaysAgo, lastActivityAt: threeDaysAgo },
      });

      const waiting = (await status().expect(200)).body as StatusBody;
      expect(waiting.currentRun).toMatchObject({
        id: asked.id,
        status: 'PEDIDA',
        requestedAt: threeDaysAgo.toISOString(),
        expired: false,
      });
      // Its turn comes when the PC is turned on: the agent still takes it
      await agentStarts()
        .expect(201)
        .expect(({ body }) => expect((body as RunBody).id).toBe(asked.id));
    });

    it('asks for one run only when two administrators press at the same time', async () => {
      const [first, second] = await Promise.all([requestSync(), requestSync()]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      expect(await openRuns()).toHaveLength(1);
    });

    it('a run EN_CURSO the agent abandoned does not block it: it ends with an error and the new one stays PEDIDA', async () => {
      const cut = (await agentStarts().expect(201)).body as RunBody;
      await e2e.prisma.syncRunModel.update({
        where: { id: cut.id },
        data: { lastActivityAt: new Date(Date.now() - 31 * 60_000) },
      });
      expect(
        ((await status().expect(200)).body as StatusBody).currentRun,
      ).toMatchObject({ id: cut.id, expired: true });

      const asked = (await requestSync().expect(201)).body as RunBody;

      expect(asked.status).toBe('PEDIDA');
      expect(
        await e2e.prisma.syncRunModel.findUniqueOrThrow({
          where: { id: cut.id },
        }),
      ).toMatchObject({ status: 'ERROR' });
    });
  });

  describe('the question of the agent (HU-166)', () => {
    it('answers 401 without its token or with another, and records no contact', async () => {
      const before = await lastContact();

      for (const token of [null, randomBytes(32).toString('hex')]) {
        const call = request(e2e.server).get(
          `${API}/everything/sync-runs/requested`,
        );
        const response = await (token
          ? call.set('Authorization', `Bearer ${token}`)
          : call);
        expect(response.status).toBe(401);
        expect((response.body as ErrorBody).code).toBe('INVALID_AGENT_TOKEN');
      }
      expect(await lastContact()).toEqual(before);
    });

    it('does not take the session of an administrator: 401', async () => {
      await request(e2e.server)
        .get(`${API}/everything/sync-runs/requested`)
        .set('Authorization', bearer(admin))
        .expect(401);
    });
  });

  describe('the rules of sync_runs in PostgreSQL', () => {
    it('never keeps two runs PEDIDA or EN_CURSO, and a run PEDIDA has not started', async () => {
      const asked = (await requestSync().expect(201)).body as RunBody;
      const base = {
        lastActivityAt: new Date(),
        requestedAt: new Date(),
        requestedById: admin.userId,
      };

      // sync_runs_single_open_idx
      await expect(
        e2e.prisma.syncRunModel.create({
          data: {
            ...base,
            id: '00000000-0000-4000-8000-000000000138',
            status: 'EN_CURSO',
            startedAt: new Date(),
          },
        }),
      ).rejects.toThrow();
      // sync_runs_started_at_check
      await expect(
        e2e.prisma.syncRunModel.update({
          where: { id: asked.id },
          data: { startedAt: new Date() },
        }),
      ).rejects.toThrow();
      expect(await openRuns()).toHaveLength(1);
    });
  });

  describe('without EVERYTHING_AGENT_TOKEN in the backend', () => {
    it('the state says the integration is disabled, and asking answers 503 and saves nothing', async () => {
      delete process.env.EVERYTHING_AGENT_TOKEN;
      const disabled = await createE2eApp();
      process.env.EVERYTHING_AGENT_TOKEN = TOKEN;
      try {
        const disabledStatus = await request(disabled.server)
          .get(`${API}/everything/sync-status`)
          .set('Authorization', bearer(admin))
          .expect(200);
        expect((disabledStatus.body as StatusBody).enabled).toBe(false);

        const asked = await request(disabled.server)
          .post(`${API}/everything/sync-requests`)
          .set('Authorization', bearer(admin))
          .expect(503);
        expect((asked.body as ErrorBody).code).toBe('EVERYTHING_SYNC_DISABLED');

        const agentAsking = await request(disabled.server)
          .get(`${API}/everything/sync-runs/requested`)
          .set('Authorization', `Bearer ${TOKEN}`)
          .expect(503);
        expect((agentAsking.body as ErrorBody).code).toBe(
          'EVERYTHING_SYNC_DISABLED',
        );
        expect(await openRuns()).toHaveLength(0);
      } finally {
        await disabled.app.close();
      }
    });
  });
});
