import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * HU-140 through Nginx (`http://localhost:8080`) with the demo seed:
 * - `/api/v1/materials` reaches the backend and never exposes `digitalPath`
 * - `PERSONAL` sees `Copia digital: Sí/No`, only the leaf folder name in
 *   Everything (no drive letter or parent path), and review notices
 * - `PUBLICO` sees only digital availability (`Sí · Disponible en digital` /
 *   `No`), without folder name or review flag
 * - `/solicitudes/:id` shows `Copia digital: Sí / No`, the leaf folder name,
 *   and review notices for staff
 * - No links or buttons exist to open or download files
 */

interface Session {
  accessToken: string;
  refreshToken: string;
}

// Demo seed catalog codes (`MATERIALS`) and tracking codes (`REQUESTS`) from
// `backend/prisma/seed.ts`, loaded when the stack starts with `RUN_SEED=true`.
const WITH_COPY_CODE = 'NOT1-1931-0001-0109';
const WITH_COPY_FOLDER = '1ra-1931 - Esc 0001-0109 - Ene';
const REVIEW_CODE = 'PER-7C52B4D6';
const REVIEW_FOLDER = '1925-03 Marzo';
const WITHOUT_COPY_CODE = 'NOT4-1956-0001-0180';

const REQ_WITH_COPY_TRACKING = 'SOL-2026-90001';
const REQ_WITH_COPY_MATERIAL = 'NOT1-1931-0207-0303';
const REQ_WITH_COPY_FOLDER = '1ra-1931 - Esc 0207-0303 - Mar';
const REQ_REVIEW_TRACKING = 'SOL-2026-90002';
const REQ_WITHOUT_COPY_TRACKING = 'SOL-2026-90011';

async function signIn(
  request: APIRequestContext,
  email: string,
): Promise<Session> {
  const response = await request.post('/api/v1/auth/login', {
    data: {
      email,
      password: process.env.SEED_DEMO_PASSWORD ?? '12345678',
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Session;
}

async function seedBrowserSession(page: Page, session: Session): Promise<void> {
  await page.addInitScript((tokens) => {
    sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
  }, session);
}

async function findRequestIdByTracking(
  request: APIRequestContext,
  headers: Record<string, string>,
  trackingCode: string,
  materialCode: string,
): Promise<string> {
  const response = await request.get('/api/v1/requests', {
    headers,
    params: { material: materialCode, limit: '20' },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    items: { id: string; trackingCode: string }[];
  };
  const found = body.items.find((item) => item.trackingCode === trackingCode);
  expect(found, `${trackingCode} in seed`).toBeDefined();
  return found!.id;
}

test('API and staff UI show folder name and review flag without full path through Nginx', async ({
  page,
  request,
}, testInfo) => {
  const staff = await signIn(request, 'personal1@example.com');
  const staffHeaders = { Authorization: `Bearer ${staff.accessToken}` };

  // Verify API payloads directly through Nginx for staff
  for (const code of [WITH_COPY_CODE, REVIEW_CODE, WITHOUT_COPY_CODE]) {
    const apiRes = await request.get('/api/v1/materials', {
      headers: staffHeaders,
      params: { q: code },
    });
    expect(apiRes.status()).toBe(200);
    const { items } = (await apiRes.json()) as {
      items: Record<string, unknown>[];
    };
    const item = items.find((m) => m.catalogCode === code);
    expect(item, `${code} returned by /api/v1/materials`).toBeDefined();
    expect(item).not.toHaveProperty('digitalPath');
    expect(JSON.stringify(item)).not.toContain('docs_simulados');
    expect(JSON.stringify(item)).not.toContain('C:\\\\');
  }

  await seedBrowserSession(page, staff);
  const initialLoad = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === '/api/v1/materials' &&
      res.request().method() === 'GET',
  );
  await page.goto('/personal/materiales');
  expect((await initialLoad).status()).toBe(200);

  // Search material with digital copy and no review flag
  const searchBox = page.getByRole('searchbox', { name: 'Buscar' });
  await searchBox.fill(WITH_COPY_CODE);
  const copyResponse = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === '/api/v1/materials' &&
      new URL(res.url()).searchParams.get('q') === WITH_COPY_CODE,
  );
  await page.getByRole('button', { name: 'Buscar' }).click();
  expect((await copyResponse).status()).toBe(200);

  const rowWithCopy = page.getByRole('row', { name: new RegExp(WITH_COPY_CODE) });
  await expect(rowWithCopy).toBeVisible();
  await expect(rowWithCopy).toContainText('Sí');
  await expect(rowWithCopy).toContainText(WITH_COPY_FOLDER);
  await expect(rowWithCopy).not.toContainText('docs_simulados');
  await expect(rowWithCopy).not.toContainText('C:\\');
  await expect(rowWithCopy).not.toContainText('Para revisión');
  await expect(rowWithCopy.getByRole('link')).toHaveCount(0);

  // Search material marked for review (NO_PATTERN)
  await searchBox.fill(REVIEW_CODE);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const rowReview = page.getByRole('row', { name: new RegExp(REVIEW_CODE) });
  await expect(rowReview).toBeVisible();
  await expect(rowReview).toContainText('Sí');
  await expect(rowReview).toContainText(REVIEW_FOLDER);
  await expect(rowReview).toContainText('Para revisión: Sin código válido');

  // Search material without digital copy
  await searchBox.fill(WITHOUT_COPY_CODE);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const rowWithout = page.getByRole('row', {
    name: new RegExp(WITHOUT_COPY_CODE),
  });
  await expect(rowWithout).toBeVisible();
  await expect(rowWithout).toContainText('No');

  await page.screenshot({
    path: testInfo.outputPath('personal-materiales-hu140.png'),
    fullPage: true,
  });
});

test('Public user only sees digital availability without folder name or review flag through Nginx', async ({
  page,
  request,
}, testInfo) => {
  const publicUser = await signIn(request, 'publico1@example.com');
  const publicHeaders = { Authorization: `Bearer ${publicUser.accessToken}` };

  const apiRes = await request.get('/api/v1/materials', {
    headers: publicHeaders,
    params: { q: REVIEW_CODE },
  });
  expect(apiRes.status()).toBe(200);
  const { items } = (await apiRes.json()) as {
    items: Record<string, unknown>[];
  };
  const item = items.find((m) => m.catalogCode === REVIEW_CODE);
  expect(item).toBeDefined();
  expect(item).toMatchObject({ hasDigitalCopy: true });
  expect(item).not.toHaveProperty('digitalFolderName');
  expect(item).not.toHaveProperty('needsReview');
  expect(item).not.toHaveProperty('reviewReason');
  expect(item).not.toHaveProperty('digitalPath');

  await seedBrowserSession(page, publicUser);
  const initialLoad = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === '/api/v1/materials' &&
      res.request().method() === 'GET',
  );
  await page.goto('/materiales');
  expect((await initialLoad).status()).toBe(200);

  const searchBox = page.getByRole('searchbox', { name: 'Buscar' });
  await searchBox.fill(WITH_COPY_CODE);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const rowWithCopy = page.getByRole('row', { name: new RegExp(WITH_COPY_CODE) });
  await expect(rowWithCopy).toBeVisible();
  await expect(rowWithCopy).toContainText('Sí · Disponible en digital');
  await expect(rowWithCopy).not.toContainText(WITH_COPY_FOLDER);
  await expect(rowWithCopy.getByRole('link')).toHaveCount(0);

  await searchBox.fill(WITHOUT_COPY_CODE);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const rowWithout = page.getByRole('row', {
    name: new RegExp(WITHOUT_COPY_CODE),
  });
  await expect(rowWithout).toBeVisible();
  await expect(rowWithout).toContainText('No');

  await page.screenshot({
    path: testInfo.outputPath('publico-materiales-hu140.png'),
    fullPage: true,
  });
});

test('Request detail shows Copia digital, Everything folder name and review notice through Nginx', async ({
  page,
  request,
}, testInfo) => {
  const staff = await signIn(request, 'personal1@example.com');
  const headers = { Authorization: `Bearer ${staff.accessToken}` };

  const [reqCopyId, reqReviewId, reqWithoutId] = await Promise.all([
    findRequestIdByTracking(
      request,
      headers,
      REQ_WITH_COPY_TRACKING,
      REQ_WITH_COPY_MATERIAL,
    ),
    findRequestIdByTracking(request, headers, REQ_REVIEW_TRACKING, REVIEW_CODE),
    findRequestIdByTracking(
      request,
      headers,
      REQ_WITHOUT_COPY_TRACKING,
      WITHOUT_COPY_CODE,
    ),
  ]);

  await seedBrowserSession(page, staff);

  // Request with clean digital copy
  const detailCopyRes = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === `/api/v1/requests/${reqCopyId}` &&
      res.request().method() === 'GET',
  );
  await page.goto(`/solicitudes/${reqCopyId}`);
  const copyJson = (await (await detailCopyRes).json()) as {
    materials: Record<string, unknown>[];
  };
  expect(copyJson.materials[0]).not.toHaveProperty('digitalPath');
  const secCopy = page.getByRole('region', { name: 'Material solicitado' });
  await expect(secCopy).toContainText('Copia digital: Sí');
  await expect(secCopy).toContainText(
    `Carpeta en Everything: ${REQ_WITH_COPY_FOLDER}`,
  );
  await expect(secCopy).not.toContainText('docs_simulados');
  await expect(secCopy.getByRole('link')).toHaveCount(0);
  await expect(secCopy.getByRole('button')).toHaveCount(0);

  // Request with digital copy marked for review (NO_PATTERN)
  await page.goto(`/solicitudes/${reqReviewId}`);
  const secReview = page.getByRole('region', { name: 'Material solicitado' });
  await expect(secReview).toContainText('Copia digital: Sí');
  await expect(secReview).toContainText(
    `Carpeta en Everything: ${REVIEW_FOLDER}`,
  );
  await expect(secReview).toContainText('Para revisión: Sin código válido');
  await page.screenshot({
    path: testInfo.outputPath('detalle-solicitud-hu140.png'),
    fullPage: true,
  });

  // Request without digital copy
  await page.goto(`/solicitudes/${reqWithoutId}`);
  const secWithout = page.getByRole('region', { name: 'Material solicitado' });
  await expect(secWithout).toContainText('Copia digital: No');
  await expect(secWithout).not.toContainText('Carpeta en Everything');
});
