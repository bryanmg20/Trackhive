import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('ADMIN downloads both filtered CSV reports through Nginx and other roles receive 403', async ({
  page,
  request,
}, testInfo) => {
  const login = await request.post('/api/v1/auth/login', {
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.ADMIN_PASSWORD ?? 'admin12345678',
    },
  });
  expect(login.ok()).toBeTruthy();
  const session = (await login.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  await page.addInitScript((value) => {
    sessionStorage.setItem('trackhive.accessToken', value.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', value.refreshToken);
  }, session);
  const range = { from: '2026-01-01', to: '2099-12-31' };
  for (const report of ['most-requested-materials', 'attention-times']) {
    await page.goto(
      report === 'most-requested-materials'
        ? '/reportes/material-mas-solicitado'
        : '/reportes/tiempos-de-atencion',
    );
    await page
      .getByLabel(
        report === 'most-requested-materials'
          ? 'Registradas desde'
          : 'Radicadas desde',
      )
      .fill(range.from);
    await page
      .getByLabel(
        report === 'most-requested-materials'
          ? 'Registradas hasta'
          : 'Radicadas hasta',
      )
      .fill(range.to);
    if (report === 'most-requested-materials')
      await page.getByLabel('Mostrar').selectOption('20');
    await page.getByRole('button', { name: 'Aplicar fechas' }).click();
    const button = page.getByRole('button', { name: 'Exportar CSV' });
    await expect(button).toBeEnabled();
    const exporting = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/v1/reports/${report}/export`,
    );
    const downloading = page.waitForEvent('download');
    await button.focus();
    await page.keyboard.press('Enter');
    const response = await exporting;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
    const query = new URL(response.url()).searchParams;
    expect(query.get('from')).toBe(range.from);
    expect(query.get('to')).toBe(range.to);
    if (report === 'most-requested-materials')
      expect(query.get('limit')).toBe('20');
    const download = await downloading;
    expect(download.suggestedFilename()).toContain(`${range.from}_${range.to}`);
    const saved = testInfo.outputPath(`${report}.csv`);
    await download.saveAs(saved);
    const bytes = await readFile(saved);
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    expect(bytes.toString('utf16le')).toMatch(/^\uFEFFsep=,\r\n/);
    expect(bytes.toString('utf16le')).toContain(
      '"Radicadas desde","Radicadas hasta"',
    );
    expect(bytes.toString('utf16le')).toContain(
      report === 'most-requested-materials' ? '"Código"' : '"Recibida → Atendida"',
    );
    await page.screenshot({
      path: testInfo.outputPath(`${report}-exportar.png`),
      fullPage: true,
    });
  }
  for (const email of ['personal1@example.com', 'publico1@example.com']) {
    const login = await request.post('/api/v1/auth/login', {
      data: { email, password: process.env.SEED_DEMO_PASSWORD ?? 'public12345678' },
    });
    expect(login.ok()).toBeTruthy();
    const session = (await login.json()) as { accessToken: string };
    for (const report of ['most-requested-materials', 'attention-times']) {
      expect(
        (
          await request.get(`/api/v1/reports/${report}/export`, {
            headers: { Authorization: `Bearer ${session.accessToken}` },
          })
        ).status(),
      ).toBe(403);
    }
  }
});
