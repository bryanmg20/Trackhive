import { expect, test } from '@playwright/test';

/** Creates fictitious local accounts and requests. No API interception. */
test('registers, edits and reuses characterization through Nginx', async ({
  page,
  request,
  browser,
}, testInfo) => {
  const suffix = Date.now();
  const email = `hu73-public-${suffix}@example.com`;
  const visitorEmail = `hu73-visitor-${suffix}@example.com`;
  const password = 'Prueba73-segura';
  const desired = new Date();
  desired.setUTCDate(desired.getUTCDate() + 40);
  if (desired.getUTCDay() === 0) desired.setUTCDate(desired.getUTCDate() + 1);
  const date = desired.toISOString().slice(0, 10);

  expect((await request.get('/api/v1/users/me/profile')).status()).toBe(401);
  expect(
    (await request.patch('/api/v1/users/me/profile', { data: {} })).status(),
  ).toBe(401);

  await page.goto('/registro');
  await page.getByLabel('Primer nombre', { exact: true }).fill('Prueba');
  await page
    .getByLabel('Primer apellido', { exact: true })
    .fill('Caracterización');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(password);
  await page.getByLabel('Municipio o distrito').fill('Barranquilla');
  await page.getByLabel('Rango de edad').selectOption('18-28');
  await page
    .getByLabel('Grupo poblacional (opcional)')
    .selectOption('MIGRANTE');
  const options = await page
    .getByLabel('Grupo poblacional (opcional)')
    .locator('option')
    .allTextContents();
  expect(options).toHaveLength(12);
  expect(
    options.every(
      (label) => label === label.toUpperCase() && !/^\d+[.)]/.test(label),
    ),
  ).toBeTruthy();
  await page
    .getByRole('checkbox', { name: /acepto el aviso de privacidad/i })
    .check();
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cuenta creada', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ir a iniciar sesión' }).click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click();
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await expect(page.getByLabel('Municipio o distrito')).toHaveValue(
    'Barranquilla',
  );
  await expect(page.getByLabel('Rango de edad')).toHaveValue('18-28');
  await expect(page.getByLabel('Grupo poblacional (opcional)')).toHaveValue(
    'MIGRANTE',
  );

  await page.getByLabel('Municipio o distrito').fill('Soledad');
  await page.getByLabel('Rango de edad').selectOption('29-59');
  await page
    .getByLabel('Grupo poblacional (opcional)')
    .selectOption('PREFIERO_NO_RESPONDER');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Sus datos se guardaron correctamente.',
  );
  await page.reload();
  await expect(page.getByLabel('Municipio o distrito')).toHaveValue('Soledad');
  await expect(page.getByLabel('Rango de edad')).toHaveValue('29-59');
  await expect(page.getByLabel('Grupo poblacional (opcional)')).toHaveValue(
    'PREFIERO_NO_RESPONDER',
  );
  await page.screenshot({
    path: testInfo.outputPath('mi-perfil-hu73.png'),
    fullPage: true,
  });

  const login = await request.post('/api/v1/auth/login', {
    data: {
      email: 'personal1@example.com',
      password: process.env.SEED_DEMO_PASSWORD ?? '12345678',
    },
  });
  expect(login.ok()).toBeTruthy();
  const staffSession = (await login.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  const headers = { Authorization: `Bearer ${staffSession.accessToken}` };
  const materialsResponse = await request.get('/api/v1/materials', { headers });
  expect(materialsResponse.ok()).toBeTruthy();
  const materials = (await materialsResponse.json()) as {
    items: { id: string }[];
  };
  const materialId = materials.items[0].id;
  const lookupPath = `/api/v1/requesters/by-email?email=${encodeURIComponent(email)}`;
  const beforeRequest = await request.get(lookupPath, { headers });
  const before = (await beforeRequest.json()) as { requesterId: string };
  expect(before.requesterId).toBeTruthy();

  await page.goto(`/solicitudes/nueva?materiales=${materialId}`);
  await expect(page.getByLabel('Municipio o distrito')).toHaveCount(0);
  await expect(page.getByLabel('Rango de edad')).toHaveCount(0);
  await page
    .getByLabel('Motivo de la consulta')
    .fill('Prueba local de reutilización de caracterización');
  await page.getByLabel('Fecha deseada', { exact: true }).fill(date);
  const createdPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/requests' &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Enviar solicitud', exact: true })
    .click();
  expect((await createdPromise).status()).toBe(201);
  const after = await request.get(lookupPath, { headers });
  expect(await after.json()).toMatchObject({
    requesterId: before.requesterId,
    municipality: 'Soledad',
    ageRange: '29-59',
    populationGroup: 'PREFIERO_NO_RESPONDER',
  });

  const staffContext = await browser.newContext({
    baseURL: 'http://localhost:8080',
  });
  try {
    await staffContext.addInitScript((tokens) => {
      sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
      sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
    }, staffSession);
    const staff = await staffContext.newPage();
    await staff.goto(`/personal/solicitudes/nueva?materiales=${materialId}`);
    await staff.getByLabel(/Correo del solicitante/).fill(visitorEmail);
    await staff.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(
      staff.getByText('Nuevo solicitante', { exact: true }),
    ).toBeVisible();
    await staff.getByLabel(/Primer nombre/).fill('Visitante');
    await staff.getByLabel(/Primer apellido/).fill('Prueba');
    await staff.getByLabel('Municipio o distrito').fill('Galapa');
    await staff.getByLabel('Rango de edad').selectOption('60+');
    // Group is deliberately omitted: it is not mandatory.
    await staff
      .getByLabel(/Motivo de la consulta/)
      .fill('Prueba de caracterización de visitante nuevo');
    await staff.getByLabel(/Fecha deseada/).fill(date);
    await staff
      .getByRole('button', { name: 'Registrar solicitud', exact: true })
      .click();
    await expect(
      staff.getByRole('heading', { name: 'Solicitud registrada' }),
    ).toBeVisible();
    const visitorPath = `/api/v1/requesters/by-email?email=${encodeURIComponent(visitorEmail)}`;
    const visitorBefore = (await (
      await request.get(visitorPath, { headers })
    ).json()) as { requesterId: string };
    expect(visitorBefore).toMatchObject({
      municipality: 'Galapa',
      ageRange: '60+',
      populationGroup: null,
    });

    await staff
      .getByRole('button', { name: 'Registrar otra solicitud' })
      .click();
    await staff.getByLabel(/Correo del solicitante/).fill(visitorEmail);
    await staff.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(staff.getByText('Encontrado', { exact: true })).toBeVisible();
    await expect(staff.getByLabel('Municipio o distrito')).toHaveCount(0);
    await expect(staff.getByText('Galapa', { exact: true })).toBeVisible();
    await staff
      .getByLabel(/Motivo de la consulta/)
      .fill('Segunda consulta sin repetir los datos del visitante');
    await staff.getByLabel(/Fecha deseada/).fill(date);
    await staff
      .getByRole('button', { name: 'Registrar solicitud', exact: true })
      .click();
    await expect(
      staff.getByRole('heading', { name: 'Solicitud registrada' }),
    ).toBeVisible();
    const visitorAfter = await (
      await request.get(visitorPath, { headers })
    ).json();
    expect(visitorAfter).toMatchObject({
      requesterId: visitorBefore.requesterId,
      municipality: 'Galapa',
      ageRange: '60+',
      populationGroup: null,
    });
  } finally {
    await staffContext.close();
  }
});
