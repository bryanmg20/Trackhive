import { randomUUID } from 'crypto';
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

interface MaterialBody {
  catalogCode: string;
}

// Root of the simulated tree of Everything (HU-133) and the fund of notaries
const NOTARY_FUND =
  'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Notarías\\Notarías\\' +
  '1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +';

/**
 * Digital copy in `materials` and the `sync_runs` log (HU-134) against
 * PostgreSQL: the defaults of the existing rows, the CHECKs of the table and
 * the partial unique index that allows a single running sync. The API never
 * sends the path of the digital copy, and since #165 a material has no
 * physical location.
 */
describe('Material digital copy, HU-134 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let staff: Session;
  let publicUser: Session;

  /**
   * A material as the Everything sync would save it from the simulated tree
   * (HU-133): a notarial protocol whose digital copy is a leaf folder.
   */
  const createEverythingMaterial = async () => {
    const id = randomUUID();
    const catalogCode = `E2E-EV-${id.slice(0, 8).toUpperCase()}`;
    const digitalPath = `${NOTARY_FUND}\\1ra-1931 - Esc 0001-0109 - ${catalogCode}`;
    await e2e.prisma.materialModel.create({
      data: {
        id,
        catalogCode,
        title: `1ra-1931 - Esc 0001-0109 - ${catalogCode}`,
        materialType: 'PROTOCOLO_NOTARIAL',
        collection: 'Notarías',
        status: 'DISPONIBLE',
        source: 'EVERYTHING',
        digitalPath,
        lastSeenAt: new Date(),
      },
    });
    return { id, catalogCode, digitalPath };
  };

  const searchByCode = async (session: Session, catalogCode: string) => {
    const response = await request(e2e.server)
      .get(`${API}/materials`)
      .query({ q: catalogCode })
      .set('Authorization', bearer(session))
      .expect(200);
    const { items } = response.body as { items: MaterialBody[] };
    return items.find((item) => item.catalogCode === catalogCode);
  };

  const finishRunning = () =>
    e2e.prisma.syncRunModel.updateMany({
      where: { status: 'EN_CURSO' },
      data: { status: 'OK', finishedAt: new Date() },
    });

  beforeAll(async () => {
    e2e = await createE2eApp();
    staff = await signInStaffUser(e2e);
    publicUser = await signUpPublicUser(e2e.server, 'copia');
  });

  afterAll(async () => {
    // This file and the sync flow (HU-137) write sync_runs: leave no run
    // EN_CURSO behind, or the other one would get 409
    await finishRunning();
    await e2e.app.close();
  });

  describe('materials', () => {
    it('saves a material without source as MANUAL and without digital copy', async () => {
      const material = await createMaterial(e2e.prisma);

      const stored = await e2e.prisma.materialModel.findUniqueOrThrow({
        where: { id: material.id },
      });
      expect(stored).toMatchObject({
        source: 'MANUAL',
        digitalPath: null,
        lastSeenAt: null,
      });
    });

    it('saves the leaf folder of the simulated tree as the digital copy, with no location columns (#165)', async () => {
      const material = await createEverythingMaterial();

      const stored = await e2e.prisma.materialModel.findUniqueOrThrow({
        where: { id: material.id },
      });
      expect(stored).toMatchObject({
        source: 'EVERYTHING',
        collection: 'Notarías',
        materialType: 'PROTOCOLO_NOTARIAL',
        digitalPath: material.digitalPath,
      });
      // A folder, not a file of the folder
      expect(stored.digitalPath).not.toMatch(/\.[a-z]{3,4}$/i);

      const columns = await e2e.prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name IN ('materials', 'request_items')
          AND column_name IN ('depot', 'shelf', 'box', 'access_type')`;
      expect(columns).toEqual([]);
    });

    it.each([
      ['PERSONAL', () => staff],
      ['PUBLICO', () => publicUser],
    ])(
      'sends %s neither a location nor the digital path',
      async (_role, session) => {
        const { catalogCode } = await createEverythingMaterial();

        const found = await searchByCode(session(), catalogCode);

        expect(found).toBeDefined();
        expect(found).not.toHaveProperty('location');
        expect(found).not.toHaveProperty('digitalPath');
      },
    );

    it('shows the material in the request detail without location, and saves its item without access type', async () => {
      const material = await createEverythingMaterial();
      const created = await submitRequest(e2e.server, publicUser, [
        material.id,
      ]);

      const response = await request(e2e.server)
        .get(`${API}/requests/${created.id}`)
        .set('Authorization', bearer(staff))
        .expect(200);

      const { materials } = response.body as {
        materials: Array<Record<string, unknown>>;
      };
      expect(materials).toEqual([
        expect.objectContaining({ id: material.id, itemStatus: 'PENDIENTE' }),
      ]);
      expect(materials[0]).not.toHaveProperty('location');
      expect(materials[0]).not.toHaveProperty('digitalPath');

      const items = await e2e.prisma.requestItemModel.findMany({
        where: { requestId: created.id },
      });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        materialId: material.id,
        itemStatus: 'PENDIENTE',
      });
      expect(items[0]).not.toHaveProperty('accessType');
    });

    it('rejects a source that is not MANUAL or EVERYTHING', async () => {
      const id = randomUUID();

      await expect(
        e2e.prisma.materialModel.create({
          data: {
            id,
            catalogCode: `E2E-SRC-${id.slice(0, 8)}`,
            title: 'Origen desconocido',
            materialType: 'DOCUMENTO',
            collection: 'Fondo del Concejo',
            status: 'DISPONIBLE',
            source: 'EXCEL',
          },
        }),
      ).rejects.toThrow(/materials_source_check/);
    });
  });

  describe('sync_runs', () => {
    beforeEach(finishRunning);

    it('starts a run EN_CURSO and finishes it with its result', async () => {
      const run = await e2e.prisma.syncRunModel.create({
        data: { id: randomUUID() },
      });
      expect(run).toMatchObject({
        status: 'EN_CURSO',
        finishedAt: null,
        filesCount: 0,
        errorMessage: null,
      });

      const failed = await e2e.prisma.syncRunModel.update({
        where: { id: run.id },
        data: {
          status: 'ERROR',
          finishedAt: new Date(),
          filesCount: 120,
          errorMessage: 'Everything no respondió',
        },
      });
      expect(failed).toMatchObject({ status: 'ERROR', filesCount: 120 });
    });

    it('allows a single run EN_CURSO at a time', async () => {
      await e2e.prisma.syncRunModel.create({ data: { id: randomUUID() } });
      const second = randomUUID();

      await expect(
        e2e.prisma.syncRunModel.create({ data: { id: second } }),
      ).rejects.toThrow(/Unique constraint/);

      expect(
        await e2e.prisma.syncRunModel.findUnique({ where: { id: second } }),
      ).toBeNull();
    });

    it('rejects a finished run without its end or an error without its reason', async () => {
      await expect(
        e2e.prisma.syncRunModel.create({
          data: { id: randomUUID(), status: 'OK' },
        }),
      ).rejects.toThrow(/sync_runs_finished_at_check/);

      await expect(
        e2e.prisma.syncRunModel.create({
          data: { id: randomUUID(), status: 'ERROR', finishedAt: new Date() },
        }),
      ).rejects.toThrow(/sync_runs_error_message_check/);
    });
  });
});
