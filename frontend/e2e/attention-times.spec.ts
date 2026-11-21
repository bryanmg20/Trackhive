import { expect, test } from '@playwright/test';

test('ADMIN filters attention times, reads sample sizes, clears dates and uses the report at 360px', async ({
  page,
}) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'ADMIN', exp: Date.now() / 1000 + 3600 })).toString('base64url')}.signature`;
  await page.addInitScript(
    (value) => sessionStorage.setItem('trackhive.accessToken', value),
    token,
  );
  await page.route('**/api/v1/reports/attention-times?**', async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const empty = query.has('from');
    await route.fulfill({
      json: {
        from: query.get('from'),
        to: query.get('to'),
        completedRequests: empty ? 0 : 3,
        averageSeconds: empty ? null : 7200,
        states: [
          {
            state: 'RECIBIDA',
            requestCount: empty ? 0 : 3,
            averageSeconds: empty ? null : 0,
          },
          {
            state: 'EN_BUSQUEDA',
            requestCount: empty ? 0 : 1,
            averageSeconds: empty ? null : 3600,
          },
          {
            state: 'DISPONIBLE',
            requestCount: empty ? 0 : 3,
            averageSeconds: empty ? null : 3600,
          },
          { state: 'AGENDADA', requestCount: 0, averageSeconds: null },
        ],
      },
    });
  });
  await page.goto('/reportes/tiempos-de-atencion');
  await expect(
    page.getByText('3 solicitudes atendidas', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'En búsqueda' })
      .getByText('1 solicitud considerada', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Agendada' }).getByText('Sin datos'),
  ).toBeVisible();
  await page.getByLabel('Radicadas desde').fill('1980-01-01');
  await page.getByLabel('Radicadas hasta').fill('1980-01-31');
  await page.getByRole('button', { name: 'Aplicar fechas' }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('No hay solicitudes atendidas para este rango.'),
  ).toBeVisible();
  await expect(page.getByLabel('Radicadas desde')).toHaveValue('1980-01-01');
  await page.getByRole('button', { name: 'Quitar fechas' }).click();
  await expect(
    page.getByText('3 solicitudes atendidas', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
