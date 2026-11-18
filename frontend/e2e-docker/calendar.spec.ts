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

function nextServiceDayFrom(base: Date, offsetDays: number): string {
  const target = new Date(base);
  target.setUTCDate(target.getUTCDate() + offsetDays);
  if (target.getUTCDay() === 0) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.toISOString().slice(0, 10);
}

test('HU-21 · reschedules and cancels an appointment from the calendar through Nginx at http://localhost:8080', async ({
  page,
  request,
}) => {
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

  const publicLogin = await request.post('/api/v1/auth/login', {
    data: {
      email: 'publico1@example.com',
      password: process.env.SEED_DEMO_PASSWORD ?? '1',
    },
  });
  expect(publicLogin.ok()).toBeTruthy();
  const publicSession = (await publicLogin.json()) as {
    accessToken: string;
  };

  const matsRes = await request.get('/api/v1/materials?limit=100', { headers });
  const materials = (
    (await matsRes.json()) as { items: { id: string; status: string }[] }
  ).items.filter(
    (item) => !['EN_RESTAURACION', 'NO_CONSULTABLE'].includes(item.status),
  );
  const material = materials[0];

  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 800 + Math.floor(Math.random() * 400));
  const initialDate = nextServiceDayFrom(base, 0);
  const conflictDate = nextServiceDayFrom(new Date(`${initialDate}T00:00:00Z`), 2);
  const freeDate = nextServiceDayFrom(new Date(`${conflictDate}T00:00:00Z`), 2);

  async function createAndSchedule(appointmentDate: string) {
    const createRes = await request.post('/api/v1/requests/on-behalf', {
      headers,
      data: {
        requester: {
          email: 'publico1@example.com',
          firstName: 'Prueba',
          lastName: 'HU21',
        },
        materialIds: [material.id],
        reason: `Prueba HU-21 ${Date.now()}`,
        desiredDate: initialDate,
        deliveryMode: 'PRESENCIAL',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as {
      id: string;
      trackingCode: string;
    };
    for (const status of ['EN_BUSQUEDA', 'DISPONIBLE']) {
      await request.patch(`/api/v1/requests/${created.id}/status`, {
        headers,
        data: { status },
      });
    }
    const schedRes = await request.post(
      `/api/v1/requests/${created.id}/appointments`,
      { headers, data: { date: appointmentDate } },
    );
    expect(schedRes.status()).toBe(201);
    const scheduled = (await schedRes.json()) as {
      appointment: { id: string };
    };
    return { ...created, appointmentId: scheduled.appointment.id };
  }

  const first = await createAndSchedule(initialDate);
  await createAndSchedule(conflictDate);

  // Verify 403 for PUBLICO user on reschedule and cancel endpoints
  const forbiddenReschedule = await request.patch(
    `/api/v1/appointments/${first.appointmentId}/reschedule`,
    {
      headers: { Authorization: `Bearer ${publicSession.accessToken}` },
      data: { date: freeDate },
    },
  );
  expect(forbiddenReschedule.status()).toBe(403);

  const forbiddenCancel = await request.patch(
    `/api/v1/appointments/${first.appointmentId}/cancel`,
    {
      headers: { Authorization: `Bearer ${publicSession.accessToken}` },
      data: {},
    },
  );
  expect(forbiddenCancel.status()).toBe(403);

  await page.addInitScript((tokens) => {
    sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
  }, session);
  await page.goto('/calendario');
  await page.getByLabel('Fecha desde', { exact: true }).fill(initialDate);
  await page.getByLabel('Fecha hasta', { exact: true }).fill(freeDate);

  const appointmentCard = page.getByRole('button', {
    name: new RegExp(first.trackingCode),
  });
  await appointmentCard.click();

  const detail = page.getByRole('region', {
    name: new RegExp(`detalle de la cita · ${first.trackingCode}`, 'i'),
  });
  await expect(detail).toBeVisible();

  // 1. Try rescheduling to conflictDate -> error shown on calendar screen
  await detail.getByLabel('Nueva fecha de la cita').fill(conflictDate);
  await detail.getByRole('button', { name: 'Reprogramar cita' }).click();
  await expect(detail.getByRole('alert')).toContainText(/ya tiene cita/i);

  // 2. Reschedule to freeDate -> succeeds
  await detail.getByLabel('Nueva fecha de la cita').fill(freeDate);
  await detail.getByRole('button', { name: 'Reprogramar cita' }).click();
  await expect(detail.getByRole('status')).toContainText(/cita reprogramada/i);

  // 3. Cancel appointment -> status becomes Cancelada and request returns to Disponible
  await detail.getByRole('button', { name: 'Cancelar cita' }).click();
  await expect(detail.getByRole('status')).toContainText(/cita cancelada/i);
  await expect(detail).toContainText('Cancelada');
  await expect(detail).toContainText('Disponible');
});
