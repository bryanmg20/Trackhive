import { expect, test } from '@playwright/test';

test('busy days keep equal rows, expose all appointments by keyboard and become an agenda at 360px', async ({
  page,
}) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'PERSONAL', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  await page.addInitScript(
    (value) => sessionStorage.setItem('trackhive.accessToken', value),
    token,
  );
  const items = Array.from({ length: 27 }, (_, index) => ({
    id: `appointment-${index}`,
    date: index < 15 ? '2026-11-20' : '2026-11-21',
    serviceHours: { opensAt: '08:00', closesAt: '17:00' },
    status: 'PROGRAMADA',
    notes: null,
    createdAt: '2026-11-01T12:00:00Z',
    request: {
      id: `request-${index}`,
      trackingCode: `SOL-2026-${index}`,
      status: 'AGENDADA',
      deliveryMode: 'PRESENCIAL',
    },
    requester: {
      id: `person-${index}`,
      name: `Visitante ${index}`,
      email: null,
      phone: null,
      requesterType: 'CIUDADANO',
      institution: null,
      documentType: null,
      documentNumber: null,
    },
    scheduledBy: { id: 'staff', name: 'Personal' },
    materials: [
      {
        id: `material-${index}`,
        title: `Documento histórico con un título muy largo ${index}`,
        catalogCode: `DOC-${index}`,
        materialType: 'DOCUMENTO',
      },
    ],
  }));
  await page.route('**/api/v1/appointments?**', async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const limit = Number(query.get('limit'));
    const offset = (Number(query.get('page')) - 1) * limit;
    await route.fulfill({
      json: {
        items: items.slice(offset, offset + limit),
        total: items.length,
        page: Number(query.get('page')),
        limit,
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/calendario');
  const calendar = page.getByRole('region', {
    name: /calendario de noviembre/i,
  });
  await expect(calendar).toBeVisible();
  const busyDay = calendar.locator('[data-date="2026-11-20"]');
  await expect(busyDay.locator('li:visible')).toHaveCount(3);
  // WF-11: the month shows the figure in its colour; the state is in the name
  await expect(busyDay.getByText('15/15', { exact: true })).toBeVisible();
  await expect(
    busyDay.getByLabel(/ocupación 15 de 15, capacidad alcanzada/),
  ).toBeVisible();
  const nearDay = calendar.locator('[data-date="2026-11-21"]');
  await expect(nearDay.getByText('12/15', { exact: true })).toBeVisible();
  await expect(
    nearDay.getByLabel(/ocupación 12 de 15, cerca del límite/),
  ).toBeVisible();
  const heights = await calendar
    .locator('[data-date]')
    .evaluateAll((cells) =>
      cells.map((cell) => cell.getBoundingClientRect().height),
    );
  expect(new Set(heights).size).toBe(1);
  const more = busyDay.getByRole('button', { name: /ver las 15 citas/i });
  await expect(more).toHaveText('+12 más');
  await more.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('listitem')).toHaveCount(15);
  await expect(
    dialog.getByRole('button', { name: 'Cerrar', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(more).toBeFocused();
  await more.press('Space');
  await dialog.getByRole('button', { name: /Visitante 14/ }).click();
  await expect(
    page.getByRole('region', { name: /detalle de la cita · SOL-2026-14/i }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(busyDay.locator('li:visible')).toHaveCount(15);
  await expect(more).not.toBeVisible();
  await expect(
    busyDay.getByText('Viernes, 20 de noviembre', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
