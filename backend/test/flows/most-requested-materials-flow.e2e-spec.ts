import request from 'supertest';
import {
  API,
  E2eApp,
  Session,
  bearer,
  createE2eApp,
  createMaterial,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
}

interface RankingBody {
  from: string | null;
  to: string | null;
  totalRequests: number;
  items: {
    rank: number;
    materialId: string;
    catalogCode: string;
    title: string;
    requestCount: number;
  }[];
}

/**
 * «Material más solicitado» (HU-26) against PostgreSQL: the ranking counts
 * the requests per material, only the ones registered in the Bogota days of
 * the range, and ties share their rank. The requests are moved to March 1995
 * so the rows of the other files, registered today, never enter the range.
 */
describe('Most requested materials report, HU-26 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let requester: Session;
  let staff: Session;
  let admin: Session;

  const RANGE = { from: '1995-03-01', to: '1995-03-31' };

  const ranking = (session: Session | null, query: Record<string, unknown>) => {
    const call = request(e2e.server)
      .get(`${API}/reports/most-requested-materials`)
      .query(query);
    return session ? call.set('Authorization', bearer(session)) : call;
  };

  const registerAt = async (materialIds: string[], registeredAt: string) => {
    const created = await submitRequest(e2e.server, requester, materialIds);
    await e2e.prisma.requestModel.update({
      where: { id: created.id },
      data: { registeredAt: new Date(registeredAt) },
    });
  };

  let actas: { id: string };
  let bando: { id: string };
  let censo: { id: string };
  let diario: { id: string };

  beforeAll(async () => {
    e2e = await createE2eApp();
    requester = await signUpPublicUser(e2e.server, 'ranking');
    staff = await signInStaffUser(e2e, 'PERSONAL');
    admin = await signInStaffUser(e2e, 'ADMIN');

    actas = await createMaterial(e2e.prisma, 'Actas del Concejo de 1890');
    bando = await createMaterial(e2e.prisma, 'Bando de la Gobernación');
    censo = await createMaterial(e2e.prisma, 'Censo de 1912');
    diario = await createMaterial(e2e.prisma, 'Diario del Comercio');

    await registerAt([actas.id, bando.id], '1995-03-05T15:00:00Z');
    await registerAt([actas.id], '1995-03-10T15:00:00Z');
    await registerAt([bando.id, diario.id], '1995-03-20T15:00:00Z');
    await registerAt([diario.id], '1995-03-21T15:00:00Z');
    // 23:30 of March 31 in Bogota: inside the range
    await registerAt([actas.id, censo.id], '1995-04-01T04:30:00Z');
    // Midnight of April 1 in Bogota and the last day of February: outside
    await registerAt([censo.id, bando.id], '1995-04-01T05:00:00Z');
    await registerAt([censo.id], '1995-02-28T12:00:00Z');
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('ranks the materials of the requests registered in the range, ties together', async () => {
    const response = await ranking(staff, RANGE).expect(200);
    const body = response.body as RankingBody;

    expect(body.from).toBe(RANGE.from);
    expect(body.to).toBe(RANGE.to);
    expect(body.totalRequests).toBe(5);
    expect(
      body.items.map(({ rank, materialId, requestCount }) => ({
        rank,
        materialId,
        requestCount,
      })),
    ).toEqual([
      { rank: 1, materialId: actas.id, requestCount: 3 },
      // Same count: same rank, ordered by title
      { rank: 2, materialId: bando.id, requestCount: 2 },
      { rank: 2, materialId: diario.id, requestCount: 2 },
      { rank: 4, materialId: censo.id, requestCount: 1 },
    ]);
    expect(body.items[0]).toMatchObject({
      title: 'Actas del Concejo de 1890',
      catalogCode: expect.stringMatching(/^E2E-/) as string,
    });
  });

  it('only counts the days asked and cuts the ranking at the limit', async () => {
    const lastDay = await ranking(admin, {
      from: '1995-03-31',
      to: '1995-03-31',
    }).expect(200);
    expect(
      (lastDay.body as RankingBody).items.map((i) => i.materialId),
    ).toEqual([actas.id, censo.id]);

    const top = await ranking(staff, { ...RANGE, limit: 2 }).expect(200);
    expect((top.body as RankingBody).items.map((i) => i.materialId)).toEqual([
      actas.id,
      bando.id,
    ]);
  });

  it('returns an empty ranking for a range without requests', async () => {
    const response = await ranking(staff, {
      from: '1990-01-01',
      to: '1990-01-31',
    }).expect(200);
    expect(response.body).toEqual({
      from: '1990-01-01',
      to: '1990-01-31',
      totalRequests: 0,
      items: [],
    });
  });

  it('rejects a start after the end and a limit out of range with 400', async () => {
    const reversed = await ranking(staff, {
      from: '1995-03-31',
      to: '1995-03-01',
    }).expect(400);
    expect((reversed.body as ErrorBody).code).toBe('INVALID_REPORT_PERIOD');

    await ranking(staff, { limit: 0 }).expect(400);
    await ranking(staff, { from: '1995-02-30' }).expect(400);
  });

  it('is only for PERSONAL and ADMIN: 403 to a public user, 401 without token', async () => {
    const forbidden = await ranking(requester, RANGE).expect(403);
    expect((forbidden.body as ErrorBody).statusCode).toBe(403);
    await ranking(null, RANGE).expect(401);
  });
});
