import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

/**
 * HU-138 through Nginx on http://localhost:8080, with the demo seed:
 * - PERSONAL and PUBLICO get 403 from both endpoints of the administrator;
 * - the administrator opens /admin/sincronizacion and its calls to /api
 *   reach the backend;
 * - with EVERYTHING_AGENT_TOKEN (the one of the .env), the test also plays
 *   the agent through Nginx: it asks for «Sincronizar ahora» on the screen,
 *   sees it «pedida, esperando al agente», takes the run and closes it with
 *   an error (so the catalog does not change), and the screen shows the new
 *   result by itself.
 */

interface Session {
  accessToken: string;
  refreshToken: string;
}

interface SyncStatus {
  enabled: boolean;
  currentRun: { id: string; status: string } | null;
  lastRun: { id: string; status: string } | null;
}

const AGENT_TOKEN = process.env.EVERYTHING_AGENT_TOKEN ?? '';
const REASON = `Prueba e2e de HU-138 a través de Nginx ${Date.now()}`;

async function signIn(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<Session> {
  const response = await request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Session;
}

const admin = (request: APIRequestContext) =>
  signIn(request, 'admin@example.com', process.env.SEED_ADMIN_PASSWORD ?? '1');

const agentHeaders = { Authorization: `Bearer ${AGENT_TOKEN}` };

async function syncStatus(
  request: APIRequestContext,
  session: Session,
): Promise<SyncStatus> {
  const response = await request.get('/api/v1/everything/sync-status', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as SyncStatus;
}

/** A run left requested or open by an earlier test ends with an error. */
async function endOpenRun(request: APIRequestContext, session: Session) {
  const { currentRun } = await syncStatus(request, session);
  if (!currentRun) return;
  if (currentRun.status === 'PEDIDA') {
    const started = await request.post('/api/v1/everything/sync-runs', {
      headers: agentHeaders,
    });
    expect(started.status()).toBe(201);
  }
  const closed = await request.post(
    `/api/v1/everything/sync-runs/${currentRun.id}/close`,
    {
      headers: agentHeaders,
      data: { result: 'ERROR', errorMessage: 'Cerrada por la prueba e2e de HU-138' },
    },
  );
  expect(closed.status()).toBe(200);
}

test('only ADMIN sees and asks for the sync: PERSONAL and PUBLICO get 403 through Nginx', async ({
  page,
  request,
}) => {
  const adminSession = await admin(request);
  for (const email of ['personal1@example.com', 'publico1@example.com']) {
    const session = await signIn(
      request,
      email,
      process.env.SEED_DEMO_PASSWORD ?? '1',
    );
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    const status = await request.get('/api/v1/everything/sync-status', {
      headers,
    });
    expect(status.status(), email).toBe(403);
    const asked = await request.post('/api/v1/everything/sync-requests', {
      headers,
    });
    expect(asked.status(), email).toBe(403);
  }

  await page.addInitScript((tokens) => {
    sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
  }, adminSession);
  const statusResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/everything/sync-status',
  );
  await page.goto('/admin/sincronizacion');
  // The screen got its state from the backend, through Nginx
  expect((await statusResponse).status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Sincronización con Everything' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Última sincronización' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Agente del CLENA' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sincronización' })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('sincronizacion-escritorio.png'),
    fullPage: true,
  });
});

test('«Sincronizar ahora»: the run waits for the agent, and the screen shows the new result when the agent ends it', async ({
  page,
  request,
}) => {
  test.skip(
    AGENT_TOKEN === '',
    'Hace de agente: necesita EVERYTHING_AGENT_TOKEN, el mismo del .env del backend',
  );
  const adminSession = await admin(request);
  expect((await syncStatus(request, adminSession)).enabled).toBe(true);
  await endOpenRun(request, adminSession);

  await page.addInitScript((tokens) => {
    sessionStorage.setItem('trackhive.accessToken', tokens.accessToken);
    sessionStorage.setItem('trackhive.refreshToken', tokens.refreshToken);
  }, adminSession);
  await page.goto('/admin/sincronizacion');
  const syncNow = page.getByRole('region', { name: 'Sincronizar ahora' });

  // Press, confirm: a run PEDIDA, «pedida, esperando al agente»
  await syncNow.getByRole('button', { name: 'Sincronizar ahora' }).click();
  const asked = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/everything/sync-requests',
  );
  await syncNow.getByRole('button', { name: 'Sí, sincronizar ahora' }).click();
  expect((await asked).status()).toBe(201);
  await expect(syncNow.getByText('Pedida, esperando al agente')).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('sincronizacion-pedida.png'),
    fullPage: true,
  });

  // Pressing again asks for no other one, and says so
  await syncNow.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(syncNow.getByRole('alert')).toContainText('no se pidió otra');
  const { currentRun } = await syncStatus(request, adminSession);
  expect(currentRun?.status).toBe('PEDIDA');

  // The agent asks, takes it and ends it (with an error: the catalog does
  // not change)
  const question = await request.get('/api/v1/everything/sync-runs/requested', {
    headers: agentHeaders,
  });
  expect(await question.json()).toMatchObject({ requested: true });
  const started = await request.post('/api/v1/everything/sync-runs', {
    headers: agentHeaders,
  });
  expect(await started.json()).toMatchObject({
    id: currentRun?.id,
    status: 'EN_CURSO',
  });
  await request.post(`/api/v1/everything/sync-runs/${currentRun?.id}/close`, {
    headers: agentHeaders,
    data: { result: 'ERROR', errorMessage: REASON },
  });

  // Without reloading: the new result and its reason
  const last = page.getByRole('region', { name: 'Última sincronización' });
  await expect(last.getByText(REASON)).toBeVisible({ timeout: 20_000 });
  await expect(last.getByText('Terminó con error')).toBeVisible();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(
    syncNow.getByText('No hay ninguna sincronización pedida ni en curso.'),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Agente del CLENA' }),
  ).toContainText('hace unos segundos');
  await page.screenshot({
    path: test.info().outputPath('sincronizacion-resultado.png'),
    fullPage: true,
  });
});
