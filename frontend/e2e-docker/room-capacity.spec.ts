import { expect, test } from '@playwright/test';

/**
 * Verifies HU-20.1 through Nginx on http://localhost:8080:
 * - Calls to /api/v1/appointments/capacity reach the backend
 * - PERSONAL and PUBLICO receive 403 when trying to update capacity
 * - ADMIN can view and update capacity in /admin/capacidad-sala
 */
test('configures room daily capacity through Nginx and enforces ADMIN permissions', async ({
  page,
  request,
}) => {
  const loginAs = async (email: string, password: string) => {
    const response = await request.post('/api/v1/auth/login', {
      data: { email, password },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
  };

  const adminSession = await loginAs(
    'admin@example.com',
    process.env.SEED_ADMIN_PASSWORD ?? '1',
  );
  const personalSession = await loginAs(
    'personal1@example.com',
    process.env.SEED_DEMO_PASSWORD ?? '1',
  );
  const publicSession = await loginAs(
    'publico1@example.com',
    process.env.SEED_DEMO_PASSWORD ?? '1',
  );

  // Save current capacity so we restore it at the end of the test
  const initialGet = await request.get('/api/v1/appointments/capacity', {
    headers: { Authorization: `Bearer ${adminSession.accessToken}` },
  });
  expect(initialGet.status()).toBe(200);
  const initialConfig = (await initialGet.json()) as { dailyCapacity: number };

  try {
    // 403 for PERSONAL and PUBLICO when attempting to update capacity
    const personalPut = await request.put('/api/v1/appointments/capacity', {
      headers: { Authorization: `Bearer ${personalSession.accessToken}` },
      data: { dailyCapacity: 10 },
    });
    expect(personalPut.status()).toBe(403);

    const publicPut = await request.put('/api/v1/appointments/capacity', {
      headers: { Authorization: `Bearer ${publicSession.accessToken}` },
      data: { dailyCapacity: 10 },
    });
    expect(publicPut.status()).toBe(403);

    await page.addInitScript((tokens) => {
      sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
      sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
    }, adminSession);

    await page.goto('/admin/capacidad-sala');
    await expect(
      page.getByRole('heading', { name: 'Capacidad de la sala' }),
    ).toBeVisible();

    const input = page.getByLabel('Capacidad diaria (entero mayor que 0)');
    await expect(input).toHaveValue(String(initialConfig.dailyCapacity));

    await input.fill('25');
    const savePromise = page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/api/v1/appointments/capacity' &&
        res.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Guardar capacidad' }).click();
    const saveResponse = await savePromise;
    expect(saveResponse.status()).toBe(200);

    await expect(page.getByRole('status')).toContainText(
      'Capacidad diaria actualizada a 25 citas por día.',
    );
    await page.reload();
    await expect(
      page.getByLabel('Capacidad diaria (entero mayor que 0)'),
    ).toHaveValue('25');
  } finally {
    await request.put('/api/v1/appointments/capacity', {
      headers: { Authorization: `Bearer ${adminSession.accessToken}` },
      data: { dailyCapacity: initialConfig.dailyCapacity },
    });
  }
});
