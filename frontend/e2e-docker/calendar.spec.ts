import { expect, test } from '@playwright/test';

/** Real appointments created through the API, rendered by the Nginx build. */
test('shows a complete busy day through Nginx and the real backend', async ({
  page,
  request,
}, testInfo) => {
  const login = await request.post('/api/v1/auth/login', {
    data: {
      email: 'personal1@example.com',
      password: process.env.SEED_DEMO_PASSWORD ?? '1',
    },
  });
  expect(login.ok()).toBeTruthy();
  const session = (await login.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const response = await request.get('/api/v1/materials?limit=100', {
    headers,
  });
  expect(response.ok()).toBeTruthy();
  const materials = (
    (await response.json()) as { items: { id: string; status: string }[] }
  ).items.filter(
    (item) => !['EN_RESTAURACION', 'NO_CONSULTABLE'].includes(item.status),
  );
  expect(materials.length).toBeGreaterThanOrEqual(4);
  const desired = new Date();
  desired.setUTCDate(
    desired.getUTCDate() + 120 + Math.floor(Math.random() * 600),
  );
  if (desired.getUTCDay() === 0) desired.setUTCDate(desired.getUTCDate() + 1);
  const date = desired.toISOString().slice(0, 10);
  const createdIds: string[] = [];
  for (const material of materials.slice(0, 4)) {
    const create = await request.post('/api/v1/requests/on-behalf', {
      headers,
      data: {
        requester: {
          email: 'publico1@example.com',
          firstName: 'Prueba',
          lastName: 'Calendario',
        },
        materialIds: [material.id],
        reason: `Prueba calendario #142 ${Date.now()}`,
        desiredDate: date,
        deliveryMode: 'PRESENCIAL',
      },
    });
    expect(create.status(), await create.text()).toBe(201);
    const created = (await create.json()) as { id: string };
    createdIds.push(created.id);
    for (const status of ['EN_BUSQUEDA', 'DISPONIBLE']) {
      const change = await request.patch(
        `/api/v1/requests/${created.id}/status`,
        { headers, data: { status } },
      );
      expect(change.ok(), await change.text()).toBeTruthy();
    }
    const schedule = await request.post(
      `/api/v1/requests/${created.id}/appointments`,
      { headers, data: { date } },
    );
    expect(schedule.status(), await schedule.text()).toBe(201);
  }
  await page.addInitScript((tokens) => {
    sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
  }, session);
  await page.goto('/calendario');
  await page.getByLabel('Fecha desde', { exact: true }).fill(date);
  await page.getByLabel('Fecha hasta', { exact: true }).fill(date);
  const day = page.locator(`[data-date="${date}"]`);
  const more = day.getByRole('button', { name: /ver las 4 citas/i });
  await expect(more).toHaveText('+1 más');
  await expect(day.locator('li:visible')).toHaveCount(3);
  await expect(day.getByText('4/15', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('calendario-mes.png'),
    fullPage: true,
  });
  await more.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('listitem')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('calendario-dia.png') });
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(day.locator('li:visible')).toHaveCount(4);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.screenshot({
    path: testInfo.outputPath('calendario-movil.png'),
    fullPage: true,
  });
  // Keep demo records for manual review; record their IDs in the test report.
  await testInfo.attach('solicitudes-de-prueba', {
    body: JSON.stringify({ date, createdIds }, null, 2),
    contentType: 'application/json',
  });
});
