import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

/**
 * HU-139 through Nginx with the demo seed: creates three fictitious digital
 * requests in the local database and checks that only the one whose
 * material all has a consultable digital copy goes straight to Disponible.
 */

const MAILPIT = 'http://localhost:8025';

// Seed materials (backend/prisma/seed.ts): with copy and available, with
// copy and being restored, with copy and not consultable, without copy
const WITH_COPY = 'PER-7C52B4D6';
const RESTORING = 'PER-98EA1A48';
const NOT_CONSULTABLE = 'DOC-AF12775E';
const WITHOUT_COPY = 'NOT4-1956-0001-0180';

interface Session {
  accessToken: string;
  refreshToken: string;
}

async function signIn(request: APIRequestContext): Promise<Session> {
  const login = await request.post('/api/v1/auth/login', {
    data: {
      email: 'personal1@example.com',
      password: process.env.SEED_DEMO_PASSWORD ?? '12345678',
    },
  });
  expect(login.ok()).toBeTruthy();
  return (await login.json()) as Session;
}

async function materialId(
  request: APIRequestContext,
  headers: Record<string, string>,
  catalogCode: string,
): Promise<string> {
  const response = await request.get('/api/v1/materials', {
    headers,
    params: { q: catalogCode },
  });
  expect(response.ok()).toBeTruthy();
  const { items } = (await response.json()) as {
    items: { id: string; catalogCode: string }[];
  };
  const found = items.find((item) => item.catalogCode === catalogCode);
  expect(found, `${catalogCode} is in the seed`).toBeDefined();
  return found!.id;
}

/** Beyond the ten-business-day lead time and never on Sunday. */
function desiredDate(): string {
  const desired = new Date();
  desired.setUTCDate(desired.getUTCDate() + 40);
  if (desired.getUTCDay() === 0) desired.setUTCDate(desired.getUTCDate() + 1);
  return desired.toISOString().slice(0, 10);
}

async function createDigitalRequest(
  request: APIRequestContext,
  headers: Record<string, string>,
  materialIds: string[],
): Promise<{ id: string; trackingCode: string }> {
  const response = await request.post('/api/v1/requests/on-behalf', {
    headers,
    data: {
      requester: {
        email: 'publico1@example.com',
        firstName: 'Prueba',
        lastName: 'Local',
      },
      materialIds,
      reason: `Prueba local de HU-139 ${Date.now()}`,
      desiredDate: desiredDate(),
      deliveryMode: 'DIGITAL',
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string; trackingCode: string };
}

test('a digital request whose material has a digital copy goes straight to Disponible through Nginx', async ({
  page,
  request,
}, testInfo) => {
  const session = await signIn(request);
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const [withCopy, restoring, notConsultable, withoutCopy] = await Promise.all(
    [WITH_COPY, RESTORING, NOT_CONSULTABLE, WITHOUT_COPY].map((code) =>
      materialId(request, headers, code),
    ),
  );

  const direct = await createDigitalRequest(request, headers, [
    withCopy,
    restoring,
  ]);
  const blocked = await createDigitalRequest(request, headers, [
    notConsultable,
  ]);
  const missing = await createDigitalRequest(request, headers, [withoutCopy]);

  await page.addInitScript((tokens) => {
    sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
  }, session);

  // Every material has its copy, one being restored: Disponible, not En búsqueda
  await page.goto(`/solicitudes/${direct.id}`);
  const statusSection = page.getByRole('region', { name: 'Cambiar estado' });
  await expect(statusSection.getByRole('radio')).toHaveCount(2);
  await expect(
    statusSection.getByRole('radio', { name: 'Disponible' }),
  ).toBeVisible();
  await expect(
    statusSection.getByRole('radio', { name: 'Rechazada' }),
  ).toBeVisible();
  await expect(
    statusSection.getByRole('radio', { name: 'En búsqueda' }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole('region', { name: 'Material solicitado' })
      .getByText('Copia digital: Sí'),
  ).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath('recibida-con-copia.png'),
    fullPage: true,
  });

  await statusSection.getByRole('radio', { name: 'Disponible' }).check();
  const saving = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/v1/requests/${direct.id}/status` &&
      response.request().method() === 'PATCH',
  );
  await statusSection.getByRole('button', { name: 'Guardar cambio' }).click();
  expect((await saving).status()).toBe(200);
  await expect(statusSection.getByRole('status')).toContainText(
    'La solicitud pasó de Recibida a Disponible',
  );
  await page.screenshot({
    path: testInfo.outputPath('recibida-a-disponible.png'),
    fullPage: true,
  });

  // RN-09: the history keeps who did it
  const history = await request.get(`/api/v1/requests/${direct.id}/history`, {
    headers,
  });
  expect(history.ok()).toBeTruthy();
  const { entries } = (await history.json()) as {
    entries: { previousStatus: string | null; newStatus: string; changedBy: string }[];
  };
  expect(entries.at(-1)).toMatchObject({
    previousStatus: 'RECIBIDA',
    newStatus: 'DISPONIBLE',
    changedBy: 'Personal Uno Demo Prueba',
  });

  // HU-23: the job sends the email to Mailpit within seconds
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `subject:"${direct.trackingCode}"` },
        });
        if (!search.ok()) return [];
        const { messages } = (await search.json()) as {
          messages: { Subject: string }[];
        };
        return messages.map((message) => message.Subject);
      },
      { timeout: 40_000 },
    )
    .toContain(
      `El material de su solicitud ${direct.trackingCode} está disponible`,
    );

  // Not consultable, or without copy: En búsqueda as before, and the API refuses Disponible
  for (const other of [blocked, missing]) {
    await page.goto(`/solicitudes/${other.id}`);
    const section = page.getByRole('region', { name: 'Cambiar estado' });
    await expect(section.getByRole('radio')).toHaveCount(2);
    await expect(
      section.getByRole('radio', { name: 'En búsqueda' }),
    ).toBeVisible();
    await expect(section.getByRole('radio', { name: 'Disponible' })).toHaveCount(
      0,
    );

    const refused = await request.patch(`/api/v1/requests/${other.id}/status`, {
      headers,
      data: { status: 'DISPONIBLE' },
    });
    expect(refused.status()).toBe(409);
    expect(((await refused.json()) as { code: string }).code).toBe(
      'INVALID_STATUS_TRANSITION',
    );
  }
  await page.screenshot({
    path: testInfo.outputPath('recibida-sin-copia.png'),
    fullPage: true,
  });
});
