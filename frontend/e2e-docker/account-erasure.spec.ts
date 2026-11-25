import { expect, test } from '@playwright/test';
test('registers and deletes a disposable account through nginx, invalidating login and both tokens', async ({
  page,
  request,
}, testInfo) => {
  const email = `hu33-${Date.now()}@example.test`;
  const password = 'DeleteAccount2026!';
  const registration = await request.post('/api/v1/users', {
    data: {
      firstName: 'Prueba',
      lastName: 'Supresión',
      email,
      password,
      acceptedPrivacy: true,
      privacyPolicyVersion: '1.1',
      municipality: 'Barranquilla',
      ageRange: '18-28',
      populationGroup: 'PREFIERO_NO_RESPONDER',
    },
  });
  expect(registration.status()).toBe(201);
  const login = await request.post('/api/v1/auth/login', {
    data: { email, password },
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
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/mi-perfil');
  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('confirmacion-eliminar-cuenta-360.png'),
    fullPage: true,
  });
  await dialog.getByRole('checkbox').check();
  await page
    .getByRole('button', { name: 'Confirmar eliminación' })
    .press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Cuenta eliminada' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('cuenta-eliminada-360.png'),
    fullPage: true,
  });
  expect(
    (
      await request.post('/api/v1/auth/login', { data: { email, password } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/v1/auth/refresh', {
        data: { refreshToken: session.refreshToken },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get('/api/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.delete('/api/v1/users/me/profile', {
        data: { confirmation: true },
      })
    ).status(),
  ).toBe(401);
});
