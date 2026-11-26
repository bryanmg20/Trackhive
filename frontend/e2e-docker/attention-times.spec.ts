import { expect, test } from '@playwright/test';

/** Existing demo data only. Verifies the production build and API through Nginx. */
test('ADMIN reads and filters attention times through Nginx; other roles receive 403', async ({
  page,
  request,
}, testInfo) => {
  const login = await request.post('/api/v1/auth/login', {
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.ADMIN_PASSWORD ?? '12345678',
    },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const session = (await login.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const result = await request.get('/api/v1/reports/attention-times', {
    headers,
  });
  expect(result.status(), await result.text()).toBe(200);
  const data = (await result.json()) as {
    completedRequests: number;
    averageSeconds: number | null;
  };
  await page.addInitScript((value) => {
    sessionStorage.setItem('trackhive.accessToken', value.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', value.refreshToken);
  }, session);
  await page.goto('/reportes/tiempos-de-atencion');
  await expect(
    page.getByText(
      `${data.completedRequests} ${data.completedRequests === 1 ? 'solicitud atendida' : 'solicitudes atendidas'}`,
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('tiempos-escritorio.png'),
    fullPage: true,
  });
  await page.getByLabel('Radicadas desde').fill('1980-01-01');
  await page.getByLabel('Radicadas hasta').fill('1980-01-31');
  const response = page.waitForResponse((res) =>
    res
      .url()
      .includes(
        '/api/v1/reports/attention-times?from=1980-01-01&to=1980-01-31',
      ),
  );
  await page.getByRole('button', { name: 'Aplicar fechas' }).click();
  expect((await response).status()).toBe(200);
  await expect(
    page.getByText('No hay solicitudes atendidas para este rango.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Quitar fechas' }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole('heading', { name: 'Tiempo promedio por estado' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.screenshot({
    path: testInfo.outputPath('tiempos-movil.png'),
    fullPage: true,
  });
  for (const email of ['personal1@example.com', 'publico1@example.com']) {
    const signed = await request.post('/api/v1/auth/login', {
      data: { email, password: process.env.SEED_DEMO_PASSWORD ?? '12345678' },
    });
    expect(signed.ok()).toBeTruthy();
    const { accessToken } = (await signed.json()) as { accessToken: string };
    expect(
      (
        await request.get('/api/v1/reports/attention-times', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ).status(),
    ).toBe(403);
  }
});
