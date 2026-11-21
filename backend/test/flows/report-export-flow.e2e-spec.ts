import request from 'supertest';
import {
  API,
  bearer,
  changeStatus,
  createE2eApp,
  createMaterial,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
} from '../support/e2e-app';
import type { E2eApp, Session } from '../support/e2e-app';
import type { MostRequestedMaterialsResponseDto } from '../../src/requests/application/dto/most-requested-materials-response.dto';
import type { AttentionTimesResponseDto } from '../../src/requests/application/dto/attention-times-response.dto';

jest.setTimeout(30000);

/** Test-side CSV reader handles quoted commas, doubled quotes and embedded LF. */
function readCsv(text: string): string[][] {
  expect(text).toMatch(/^\uFEFF?sep=,\r\n/);
  const source = text.replace(/^\uFEFF?sep=,\r\n/, '');
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(value);
      value = '';
    } else if (!quoted && char === '\r' && source[index + 1] === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      index += 1;
    } else value += char;
  }
  expect(quoted).toBe(false);
  expect(row).toEqual([]);
  return rows;
}

describe('CSV report export, HU-27 (PostgreSQL)', () => {
  let e2e: E2eApp, admin: Session, staff: Session, publicUser: Session;
  const range = { from: '2004-01-01', to: '2004-01-31' };
  const call = (
    report: string,
    session: Session | null,
    query: Record<string, unknown>,
    csv = true,
  ) => {
    const test = request(e2e.server)
      .get(`${API}/reports/${report}${csv ? '/export' : ''}`)
      .query(query);
    return session ? test.set('Authorization', bearer(session)) : test;
  };
  beforeAll(async () => {
    e2e = await createE2eApp();
    admin = await signInStaffUser(e2e, 'ADMIN');
    staff = await signInStaffUser(e2e, 'PERSONAL');
    publicUser = await signUpPublicUser(e2e.server, 'csv');
    const first = await createMaterial(e2e.prisma, 'Actas, "año"\n1890');
    const formula = await createMaterial(e2e.prisma, '=1+1');
    for (const [index, materialIds] of [
      [first.id, formula.id],
      [first.id],
      [formula.id],
    ].entries()) {
      const created = await submitRequest(
        e2e.server,
        publicUser,
        materialIds,
        'DIGITAL',
      );
      await e2e.prisma.requestModel.update({
        where: { id: created.id },
        data: {
          registeredAt: new Date(
            index === 2
              ? '2004-02-01T05:00:00Z'
              : `2004-01-0${index + 3}T12:00:00Z`,
          ),
        },
      });
      if (index === 0)
        for (const status of ['EN_BUSQUEDA', 'DISPONIBLE', 'ATENDIDA']) {
          await changeStatus(e2e.server, staff, created.id, { status }).expect(
            200,
          );
        }
    }
  });
  afterAll(async () => {
    await e2e?.app.close();
  });

  it('exports the same filtered ranking, order and limit as JSON, with proper CSV attachment headers', async () => {
    const filters = { ...range, limit: 1 };
    const json = await call(
      'most-requested-materials',
      admin,
      filters,
      false,
    ).expect(200);
    const data = json.body as MostRequestedMaterialsResponseDto;
    const exported = await call(
      'most-requested-materials',
      admin,
      filters,
    ).expect(200);
    expect(exported.headers['content-type']).toContain(
      'text/csv; charset=utf-8',
    );
    expect(exported.headers['content-disposition']).toContain(
      'attachment; filename="material-mas-solicitado_2004-01-01_2004-01-31_top-1.csv"',
    );
    const text = exported.text;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const rows = readCsv(text);
    expect(rows).toHaveLength(data.items.length + 1);
    expect(rows[1]).toEqual([
      range.from,
      range.to,
      String(data.totalRequests),
      String(data.items[0].rank),
      data.items[0].catalogCode,
      data.items[0].title,
      data.items[0].materialType,
      String(data.items[0].requestCount),
    ]);
    expect(rows[1][7]).toBe('2');
    const all = await call('most-requested-materials', admin, {
      ...range,
      limit: 10,
    }).expect(200);
    expect(readCsv(all.text).map((row) => row[5])).toContain("'=1+1");
  });

  it('exports the total and each attention state without turning missing observations into zero', async () => {
    const json = await call('attention-times', admin, range, false).expect(200);
    const data = json.body as AttentionTimesResponseDto;
    const exported = await call('attention-times', admin, range).expect(200);
    const rows = readCsv(exported.text);
    expect(rows).toHaveLength(data.states.length + 2);
    expect(rows[1]).toEqual([
      range.from,
      range.to,
      'Total',
      'Recibida → Atendida',
      String(data.completedRequests),
      String(data.averageSeconds),
    ]);
    expect(rows.find((row) => row[3] === 'Agendada')?.slice(-2)).toEqual([
      '0',
      '',
    ]);
    for (const [index, item] of data.states.entries()) {
      expect(rows[index + 2].slice(-2)).toEqual([
        String(item.requestCount),
        item.averageSeconds === null ? '' : String(item.averageSeconds),
      ]);
    }
  });

  it('exports a valid empty ranking and a report without observations', async () => {
    const filters = { from: '1970-01-01', to: '1970-01-02' };
    const ranking = await call(
      'most-requested-materials',
      admin,
      filters,
    ).expect(200);
    expect(readCsv(ranking.text)).toHaveLength(1);
    const attention = await call('attention-times', admin, filters).expect(200);
    expect(
      readCsv(attention.text)
        .slice(1)
        .every((row) => row[4] === '0' && row[5] === ''),
    ).toBe(true);
  });

  it('requires ADMIN on both exports and rejects invalid filters without writing data', async () => {
    const counts = async () => [
      await e2e.prisma.requestModel.count(),
      await e2e.prisma.statusHistoryModel.count(),
      await e2e.prisma.notificationModel.count(),
    ];
    const before = await counts();
    for (const report of ['most-requested-materials', 'attention-times']) {
      await call(report, staff, range).expect(403);
      await call(report, publicUser, range).expect(403);
      await call(report, null, range).expect(401);
      await call(report, admin, {
        from: '2004-02-01',
        to: '2004-01-01',
      }).expect(400);
      await call(report, admin, { from: '2004-02-30' }).expect(400);
    }
    await call('most-requested-materials', admin, {
      ...range,
      limit: 0,
    }).expect(400);
    await call('most-requested-materials', staff, range, false).expect(200);
    expect(await counts()).toEqual(before);
  });
});
