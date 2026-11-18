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
  location?: { depot: string; shelf: string; box: string } | null;
}

/**
 * Digital copy in `materials` and the `sync_runs` log (HU-134) against
 * PostgreSQL: the defaults of the existing rows, the CHECKs that keep the
 * location whole, and the partial unique index that allows a single running
 * sync. The API never sends the path of the digital copy.
 */
describe('Material digital copy, HU-134 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let staff: Session;
  let publicUser: Session;

  /** A material as the Everything sync would save it: no physical location. */
  const createEverythingMaterial = async () => {
    const id = randomUUID();
    const catalogCode = `E2E-EV-${id.slice(0, 8).toUpperCase()}`;
    await e2e.prisma.materialModel.create({
      data: {
        id,
        catalogCode,
        title: 'Crónicas del puerto',
        materialType: 'OTRO',
        collection: 'Libros y Revistas',
        status: 'DISPONIBLE',
        source: 'EVERYTHING',
        digitalPath: `D:\\Digitalizados\\${catalogCode}\\copia.pdf`,
        lastSeenAt: new Date(),
      },
    });
    return { id, catalogCode };
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
    // Only this file writes sync_runs: leave no run EN_CURSO behind
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
        depot: 'D1',
        shelf: 'E3',
        box: 'C12',
      });
    });

    it('sends location null to the staff for a material without location, and never the digital path', async () => {
      const { catalogCode } = await createEverythingMaterial();

      const found = await searchByCode(staff, catalogCode);

      expect(found).toBeDefined();
      expect(found?.location).toBeNull();
      expect(found).not.toHaveProperty('digitalPath');
    });

    it('sends no location at all to the PUBLICO role', async () => {
      const { catalogCode } = await createEverythingMaterial();

      const found = await searchByCode(publicUser, catalogCode);

      expect(found).toBeDefined();
      expect(found).not.toHaveProperty('location');
      expect(found).not.toHaveProperty('digitalPath');
    });

    it('shows location null in the request detail of a material without location', async () => {
      const material = await createEverythingMaterial();
      const created = await submitRequest(e2e.server, publicUser, [
        material.id,
      ]);

      const response = await request(e2e.server)
        .get(`${API}/requests/${created.id}`)
        .set('Authorization', bearer(staff))
        .expect(200);

      const { materials } = response.body as {
        materials: Array<{ id: string; location: unknown }>;
      };
      expect(materials).toEqual([
        expect.objectContaining({ id: material.id, location: null }),
      ]);
    });

    it('rejects a half location and saves nothing', async () => {
      const id = randomUUID();

      await expect(
        e2e.prisma.materialModel.create({
          data: {
            id,
            catalogCode: `E2E-LOC-${id.slice(0, 8)}`,
            title: 'Ubicación incompleta',
            materialType: 'DOCUMENTO',
            collection: 'Fondo del Concejo',
            status: 'DISPONIBLE',
            depot: 'D1',
          },
        }),
      ).rejects.toThrow(/materials_location_check/);

      expect(
        await e2e.prisma.materialModel.findUnique({ where: { id } }),
      ).toBeNull();
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
