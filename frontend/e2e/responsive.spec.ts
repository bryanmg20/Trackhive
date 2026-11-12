import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { requestDetailPath, ROUTES } from '../src/routes';

type Role = 'PUBLICO' | 'PERSONAL' | 'ADMIN';

const MOBILE_WIDTH = 360;
const REQUEST_ID = 'SOL-2026-00001';

interface RouteCase {
  name: string;
  path: string;
  role: Role | null;
}

/**
 * Every path in ROUTES with the role that can open it. The coverage test below
 * fails if a new route is added and this list is not updated.
 */
const ROUTE_CASES: RouteCase[] = [
  { name: 'registro', path: ROUTES.register, role: null },
  { name: 'login', path: ROUTES.login, role: null },
  { name: 'buscar material', path: ROUTES.materials, role: 'PUBLICO' },
  { name: 'radicar solicitud', path: ROUTES.newRequest, role: 'PUBLICO' },
  { name: 'mis solicitudes', path: ROUTES.myRequests, role: 'PUBLICO' },
  {
    name: 'estado del material',
    path: ROUTES.staffMaterials,
    role: 'PERSONAL',
  },
  { name: 'solicitudes', path: ROUTES.requests, role: 'PERSONAL' },
  {
    name: 'detalle de solicitud',
    path: requestDetailPath(REQUEST_ID),
    role: 'PERSONAL',
  },
  { name: 'calendario', path: ROUTES.calendar, role: 'PERSONAL' },
  {
    name: 'ficha de solicitud',
    path: ROUTES.staffNewRequest,
    role: 'PERSONAL',
  },
];

/** A JWT the frontend can decode; the backend signature is never checked here. */
function fakeAccessToken(role: Role): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);

  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({ role, exp: now + 60 * 60 }),
    'test-signature',
  ].join('.');
}

async function seedSession(page: Page, role: Role | null): Promise<void> {
  if (!role) return;

  const accessToken = fakeAccessToken(role);
  await page.addInitScript((token) => {
    sessionStorage.setItem('trackhive.accessToken', token);
    sessionStorage.setItem('trackhive.refreshToken', 'test-refresh-token');
  }, accessToken);
}

const material = {
  id: 'material-1',
  catalogCode: 'CLENA-2026-0001',
  title:
    'Acta del Cabildo de Santafé con un título largo para probar el ajuste en pantallas pequeñas',
  materialType: 'DOCUMENTO',
  author: 'Archivo General de la Nación',
  collection: 'Actas del Cabildo',
  status: 'DISPONIBLE',
};

const myRequest = {
  id: REQUEST_ID,
  trackingCode: REQUEST_ID,
  status: 'RECHAZADA',
  deliveryMode: 'PRESENCIAL',
  desiredDate: '2026-12-01',
  registeredAt: '2026-11-10T15:00:00.000Z',
  rejectionReason:
    'El material se encuentra en restauración; puede solicitarlo de nuevo en enero.',
  materials: [
    {
      id: material.id,
      catalogCode: material.catalogCode,
      title: material.title,
    },
  ],
};

const requestListItem = {
  id: REQUEST_ID,
  trackingCode: REQUEST_ID,
  status: 'DISPONIBLE',
  deliveryMode: 'PRESENCIAL',
  desiredDate: '2026-12-01',
  registeredAt: '2026-11-10',
  requesterName: 'María Fernanda de los Ángeles Rodríguez',
  requesterEmail: 'investigadora.con.correo.largo@example.com',
  materials: [
    {
      id: material.id,
      catalogCode: material.catalogCode,
      title: material.title,
    },
  ],
};

const requestDetail = {
  id: REQUEST_ID,
  trackingCode: REQUEST_ID,
  status: 'DISPONIBLE',
  allowedTransitions: ['AGENDADA', 'RECHAZADA'],
  deliveryMode: 'PRESENCIAL',
  originChannel: 'WEB',
  reason: 'Consulta histórica sobre la organización del cabildo.',
  requirementDescription:
    'Se requiere revisar el acta completa y tomar notas sobre las decisiones del cabildo.',
  desiredDate: '2026-12-01',
  committedDate: null,
  registeredAt: '2026-11-10T15:00:00.000Z',
  rejectionReason: null,
  requester: {
    name: 'María Fernanda de los Ángeles Rodríguez',
    email: 'investigadora.con.correo.largo@example.com',
    phone: '+57 601 555 5555',
    requesterType: 'INVESTIGADOR',
    institution: 'Universidad Nacional de Colombia',
    documentType: 'CC',
    documentNumber: '1020304050',
  },
  materials: [
    {
      id: material.id,
      catalogCode: material.catalogCode,
      title: material.title,
      materialType: 'DOCUMENTO',
      author: material.author,
      collection: material.collection,
      status: 'DISPONIBLE',
      location: { depot: 'Depósito 1', shelf: 'Estante 12', box: 'Caja 4' },
      itemStatus: 'LOCALIZADO',
    },
  ],
};

const appointment = {
  id: 'appointment-1',
  date: '2026-11-15',
  serviceHours: { opensAt: '08:00', closesAt: '16:00' },
  status: 'PROGRAMADA',
  notes: 'La investigadora asistirá con su equipo de trabajo.',
  createdAt: '2026-11-01T10:00:00.000Z',
  request: {
    id: REQUEST_ID,
    trackingCode: REQUEST_ID,
    status: 'AGENDADA',
    deliveryMode: 'PRESENCIAL',
  },
  requester: requestDetail.requester,
  scheduledBy: { id: 'user-1', name: 'Personal de sala' },
  materials: [
    {
      id: material.id,
      catalogCode: material.catalogCode,
      title: material.title,
      materialType: 'DOCUMENTO',
      location: { depot: 'Depósito 1', shelf: 'Estante 12', box: 'Caja 4' },
    },
  ],
};

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (pathname === '/api/v1/materials') {
      await json({
        items: [material],
        page: 1,
        limit: 10,
        total: 1,
      });
      return;
    }

    if (pathname === '/api/v1/requests/mine') {
      await json({
        items: [myRequest],
        page: 1,
        limit: 10,
        total: 1,
      });
      return;
    }

    if (pathname === '/api/v1/requests') {
      await json({
        items: [requestListItem],
        page: 1,
        limit: 10,
        total: 1,
      });
      return;
    }

    if (pathname === `/api/v1/requests/${REQUEST_ID}`) {
      await json(requestDetail);
      return;
    }

    if (pathname === '/api/v1/appointments') {
      await json({
        items: [appointment],
        page: 1,
        limit: 10,
        total: 1,
      });
      return;
    }

    if (pathname === '/api/v1/auth/refresh') {
      await json({
        accessToken: fakeAccessToken('PERSONAL'),
        refreshToken: 'test-refresh-token',
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Sin datos simulados para esta ruta.' }),
    });
  });
}

async function waitForStableLayout(page: Page): Promise<void> {
  await page.locator('main').first().waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // Let React commit the API response and the fonts finish one more frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(
      root.scrollWidth - root.clientWidth,
      body.scrollWidth - body.clientWidth,
    );
  });
}

test.describe('HU-29 · cada ruta de ROUTES a 360 px', () => {
  test('la lista cubre todas las rutas de ROUTES', () => {
    expect(ROUTE_CASES).toHaveLength(Object.keys(ROUTES).length);
  });

  for (const routeCase of ROUTE_CASES) {
    test(`${routeCase.name} · ${routeCase.path}`, async ({ page }) => {
      await seedSession(page, routeCase.role);
      await mockApi(page);
      await page.setViewportSize({ width: MOBILE_WIDTH, height: 800 });
      await page.goto(routeCase.path);
      await waitForStableLayout(page);

      // Guards must not redirect the route to the login screen.
      expect(new URL(page.url()).pathname).toBe(routeCase.path);

      const nav = page.getByRole('navigation', { name: 'Secciones' });
      if (routeCase.role) {
        await expect(nav).toBeVisible();
      }

      const overflow = await horizontalOverflow(page);
      expect(
        overflow,
        `${routeCase.path} desborda ${overflow}px a ${MOBILE_WIDTH}px de ancho`,
      ).toBeLessThanOrEqual(0);
    });
  }
});

test('el menú se adapta al redimensionar sin cortar contenido', async ({
  page,
}) => {
  await seedSession(page, 'ADMIN');
  await mockApi(page);
  await page.goto(ROUTES.requests);
  await waitForStableLayout(page);

  const nav = page.getByRole('navigation', { name: 'Secciones' });
  await expect(nav).toBeVisible();

  for (const width of [360, 390, 480, 600, 768, 900, 1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await waitForStableLayout(page);

    const overflow = await horizontalOverflow(page);
    expect(
      overflow,
      `la página desborda ${overflow}px a ${width}px de ancho`,
    ).toBeLessThanOrEqual(0);

    // Every link and the logout button stay fully inside the viewport.
    const clipped = await page.evaluate(() => {
      const menu = document.querySelector('nav[aria-label="Secciones"]');
      if (!menu) return true;
      const viewport = document.documentElement.clientWidth;

      return [...menu.querySelectorAll('a, button')].some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewport + 1;
      });
    });
    expect(clipped, `algún enlace del menú se corta a ${width}px`).toBe(false);
  }
});
