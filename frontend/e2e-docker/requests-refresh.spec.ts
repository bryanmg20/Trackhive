import { expect, test } from '@playwright/test';

/** Uses demo accounts and creates one fictitious request in the local database. */
test('refreshes through Nginx preserving filters, page and scroll', async ({ page, request }) => {
  const login = await request.post('/api/v1/auth/login', {
    data: {
      email: 'personal1@example.com',
      password: process.env.SEED_DEMO_PASSWORD ?? '1',
    },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json() as { accessToken: string; refreshToken: string };
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const materialsResponse = await request.get('/api/v1/materials', { headers });
  expect(materialsResponse.ok()).toBeTruthy();
  const materials = await materialsResponse.json() as { items: { id: string }[] };
  expect(materials.items.length).toBeGreaterThan(0);

  await page.addInitScript((tokens) => {
    sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
  }, session);
  await page.goto('/solicitudes');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Fecha deseada hasta').fill('2099-12-31');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: /siguiente/i }).click();
  await expect(page.getByText(/Página 2 de/)).toBeVisible();

  // Observe removal to catch even a brief loading placeholder during polling.
  await page.evaluate(() => {
    const table = document.querySelector('table')!;
    table.setAttribute('data-refresh-test', 'original');
    new MutationObserver(() => {
      if (!table.isConnected) document.body.dataset.tableRemoved = 'true';
    }).observe(table.parentElement!, { childList: true, subtree: true });
    window.scrollTo(0, 150);
  });
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const countBefore = await page.getByRole('heading', { name: /^\d+ solicitudes$/ }).innerText();
  const totalBefore = Number.parseInt(countBefore);
  // Beyond the ten-business-day lead time and never on Sunday.
  const desired = new Date();
  desired.setUTCDate(desired.getUTCDate() + 40);
  if (desired.getUTCDay() === 0) desired.setUTCDate(desired.getUTCDate() + 1);

  const refreshedPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/requests'
      && url.searchParams.get('page') === '2'
      && url.searchParams.get('desiredTo') === '2099-12-31'
      && response.request().method() === 'GET';
  }, { timeout: 40_000 });
  const create = await request.post('/api/v1/requests/on-behalf', {
    headers,
    data: {
      requester: {
        email: 'publico1@example.com',
        firstName: 'Prueba',
        lastName: 'Local',
      },
      materialIds: [materials.items[0].id],
      reason: `Prueba local de polling #141 ${Date.now()}`,
      desiredDate: desired.toISOString().slice(0, 10),
      deliveryMode: 'PRESENCIAL',
    },
  });
  expect(create.status(), await create.text()).toBe(201);
  const created = await create.json() as { trackingCode: string };

  const refreshed = await refreshedPromise;
  expect(refreshed.status()).toBe(200);
  expect(refreshed.headers()['content-type']).toContain('application/json');
  await expect(page.getByRole('heading', { name: `${totalBefore + 1} solicitudes`, exact: true })).toBeVisible();
  await expect(page.getByText(/Página 2 de/)).toBeVisible();
  await expect(page.getByLabel('Fecha deseada hasta')).toHaveValue('2099-12-31');
  await expect(page.locator('table[data-refresh-test="original"]')).toBeAttached();
  expect(await page.locator('body').getAttribute('data-table-removed')).toBeNull();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  await page.getByRole('button', { name: /anterior/i }).click();
  await expect(page.getByRole('link', { name: created.trackingCode, exact: true })).toBeVisible();
});
