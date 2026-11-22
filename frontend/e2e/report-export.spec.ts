import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

for (const report of ['most-requested-materials', 'attention-times'] as const) {
  test(`downloads ${report} by keyboard using applied filters, not unsaved edits`, async ({
    page,
  }, testInfo) => {
    const token = `header.${Buffer.from(JSON.stringify({ role: 'ADMIN', exp: Date.now() / 1000 + 3600 })).toString('base64url')}.signature`;
    await page.addInitScript(
      (value) => sessionStorage.setItem('trackhive.accessToken', value),
      token,
    );
    const exports: Record<string, string>[] = [];
    await page.route('**/api/v1/reports/**', async (route) => {
      const url = new URL(route.request().url());
      const params = Object.fromEntries(url.searchParams);
      if (url.pathname.endsWith('/export')) {
        exports.push(params);
        await route.fulfill({
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${report}.csv"`,
          },
          body: `\uFEFF"Desde","Hasta","Límite"\r\n"${params.from}","${params.to}","${params.limit ?? ''}"\r\n`,
        });
      } else {
        await route.fulfill({
          json:
            report === 'most-requested-materials'
              ? {
                  from: params.from ?? null,
                  to: params.to ?? null,
                  totalRequests: 2,
                  items: [
                    {
                      rank: 1,
                      materialId: 'm1',
                      title: 'Actas del cabildo',
                      catalogCode: 'DOC-1',
                      materialType: 'DOCUMENTO',
                      requestCount: 2,
                    },
                  ],
                }
              : {
                  from: params.from ?? null,
                  to: params.to ?? null,
                  completedRequests: 2,
                  averageSeconds: 3600,
                  states: [
                    {
                      state: 'RECIBIDA',
                      requestCount: 2,
                      averageSeconds: 3600,
                    },
                  ],
                },
        });
      }
    });
    await page.goto(
      report === 'most-requested-materials'
        ? '/reportes/material-mas-solicitado'
        : '/reportes/tiempos-de-atencion',
    );
    const button = page.getByRole('button', { name: 'Exportar CSV' });
    await expect(button).toBeEnabled();
    const from = page.getByLabel(
      report === 'most-requested-materials'
        ? 'Registradas desde'
        : 'Radicadas desde',
    );
    await from.fill('2026-11-01');
    await page
      .getByLabel(
        report === 'most-requested-materials'
          ? 'Registradas hasta'
          : 'Radicadas hasta',
      )
      .fill('2026-11-30');
    if (report === 'most-requested-materials')
      await page.getByLabel('Mostrar').selectOption('20');
    await page.getByRole('button', { name: 'Aplicar fechas' }).click();
    await expect(button).toBeEnabled();
    await from.fill('2027-01-01');
    const downloading = page.waitForEvent('download');
    await button.focus();
    await page.keyboard.press('Enter');
    const file = await downloading;
    expect(file.suggestedFilename()).toBe(`${report}.csv`);
    const saved = testInfo.outputPath(`${report}.csv`);
    await file.saveAs(saved);
    expect(await file.failure()).toBeNull();
    const bytes = await readFile(saved);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8')).toContain('"2026-11-01","2026-11-30"');
    expect(exports).toEqual([
      {
        from: '2026-11-01',
        to: '2026-11-30',
        ...(report === 'most-requested-materials' ? { limit: '20' } : {}),
      },
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });
}

test('PERSONAL can view the ranking but has no export action', async ({
  page,
}) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'PERSONAL', exp: Date.now() / 1000 + 3600 })).toString('base64url')}.signature`;
  await page.addInitScript(
    (value) => sessionStorage.setItem('trackhive.accessToken', value),
    token,
  );
  await page.route('**/api/v1/reports/**', (route) =>
    route.fulfill({
      json: { from: null, to: null, totalRequests: 0, items: [] },
    }),
  );
  await page.goto('/reportes/material-mas-solicitado');
  await expect(
    page.getByText('No hay solicitudes en este periodo'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(
    0,
  );
});
