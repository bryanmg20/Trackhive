import { expect, test } from '@playwright/test';
test('account deletion requires confirmation, works by keyboard and fits at 360px', async ({
  page,
}) => {
  const token = `header.${Buffer.from(JSON.stringify({ role: 'PUBLICO', exp: Date.now() / 1000 + 3600 })).toString('base64url')}.signature`;
  await page.addInitScript(
    (value) => sessionStorage.setItem('trackhive.accessToken', value),
    token,
  );
  let deleted = false;
  await page.route('**/api/v1/users/me/profile', async (route) => {
    if (route.request().method() === 'DELETE') {
      expect(route.request().postDataJSON()).toEqual({ confirmation: true });
      deleted = true;
      await route.fulfill({ status: 204 });
    } else
      await route.fulfill({
        json: {
          firstName: 'Ana',
          lastName: 'Pérez',
          email: 'ana@example.test',
          municipality: 'Barranquilla',
          ageRange: '18-28',
          populationGroup: null,
        },
      });
  });
  await page.goto('/mi-perfil');
  const opener = page.getByRole('button', { name: 'Eliminar mi cuenta' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirmar eliminación' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(deleted).toBe(false);
  await opener.press('Enter');
  const checkbox = dialog.getByRole('checkbox');
  await checkbox.focus();
  await page.keyboard.press('Space');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page
    .getByRole('button', { name: 'Confirmar eliminación' })
    .press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Cuenta eliminada' }),
  ).toBeVisible();
  expect(deleted).toBe(true);
  expect(
    await page.evaluate(() => sessionStorage.getItem('trackhive.accessToken')),
  ).toBeNull();
});
