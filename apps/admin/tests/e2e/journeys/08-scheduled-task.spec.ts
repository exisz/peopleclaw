/**
 * PLANET-1460: App-scoped scheduled tasks (TDD).
 *
 * E2E (API-driven, no UI):
 *   - Mint tenant → create App + BACKEND "tick" component
 *   - POST /apps/:appId/scheduled-tasks { componentId, cron: '* * * * *' }
 *   - POST /internal/run-scheduled?force=1 with Bearer CRON_SECRET → dispatcher fires
 *   - GET /apps/:appId/scheduled-tasks → lastRunAt set, lastStatus='ok', runs.length>=1
 *   - PATCH enabled=false → re-run dispatcher → runs count unchanged
 *   - DELETE → list empty
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.peopleclaw.rollersoft.com.au';
const E2E_SECRET = process.env.E2E_SECRET ?? '';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

interface MintResult { accessToken: string; sub: string; }

async function mintToken(email: string): Promise<MintResult> {
  const res = await fetch(`${BASE_URL}/api/internal/e2e-mint-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-E2E-Secret': E2E_SECRET },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`mint failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<MintResult>;
}

async function api<T = any>(token: string, method: string, path: string, body?: any): Promise<{ status: number; json: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _raw: text }; }
  return { status: res.status, json: json as T };
}

const TICK_CODE = `
export async function run(input, ctx) {
  await peopleClaw.nodeEntry('tick:enter');
  return { tickedAt: new Date().toISOString() };
}
`;

test.describe('PLANET-1460: scheduled tasks', () => {
  test.skip(!E2E_SECRET, 'E2E_SECRET not set');
  test.skip(!CRON_SECRET, 'CRON_SECRET not set');

  test('create → dispatch → run recorded → disable → delete', async () => {
    test.setTimeout(120_000);

    const ts = Date.now();
    const a = await mintToken(`e2e-1460-${ts}@peopleclaw.test`);

    // App
    const appRes = await api(a.accessToken, 'POST', '/api/apps', { name: `1460-${ts}` });
    expect(appRes.status, JSON.stringify(appRes.json)).toBe(200);
    const appId = appRes.json.app.id as string;

    // Tick component (BACKEND)
    const compRes = await api(a.accessToken, 'POST', `/api/apps/${appId}/components`, {
      name: 'tick',
      type: 'BACKEND',
      code: TICK_CODE,
    });
    expect(compRes.status, JSON.stringify(compRes.json)).toBe(200);
    const componentId = compRes.json.component.id as string;

    // Create scheduled task
    const createRes = await api(a.accessToken, 'POST', `/api/apps/${appId}/scheduled-tasks`, {
      componentId,
      cron: '* * * * *',
    });
    expect(createRes.status, JSON.stringify(createRes.json)).toBe(200);
    const taskId = createRes.json.task.id as string;
    expect(createRes.json.task.enabled).toBe(true);

    // Validation: bad cron
    const badRes = await api(a.accessToken, 'POST', `/api/apps/${appId}/scheduled-tasks`, {
      componentId, cron: 'not-a-cron',
    });
    expect(badRes.status).toBe(400);

    // Dispatch with force=1 (deterministic, skips minute-due check)
    const dispatch1 = await fetch(`${BASE_URL}/api/internal/run-scheduled?force=1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}`, 'Content-Type': 'application/json' },
    });
    expect(dispatch1.status, await dispatch1.text().catch(() => '')).toBe(200);
    const d1 = await dispatch1.clone().json().catch(() => ({}));
    expect(d1.ran).toBeGreaterThanOrEqual(1);

    // Dispatch unauthorized
    const dispatchBad = await fetch(`${BASE_URL}/api/internal/run-scheduled?force=1`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' },
    });
    expect(dispatchBad.status).toBe(401);

    // List tasks → confirm last run + ok
    const list1 = await api(a.accessToken, 'GET', `/api/apps/${appId}/scheduled-tasks`);
    expect(list1.status).toBe(200);
    const ourTask = list1.json.tasks.find((t: any) => t.id === taskId);
    expect(ourTask).toBeDefined();
    expect(ourTask.lastRunAt).toBeTruthy();
    expect(ourTask.lastStatus).toBe('ok');
    expect(Array.isArray(ourTask.runs)).toBe(true);
    expect(ourTask.runs.length).toBeGreaterThanOrEqual(1);
    expect(ourTask.runs[0].status).toBe('ok');
    const runsBefore = ourTask.runs.length;

    // Disable
    const patchRes = await api(a.accessToken, 'PATCH', `/api/scheduled-tasks/${taskId}`, { enabled: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.json.task.enabled).toBe(false);

    // Re-dispatch — disabled task should NOT run
    const dispatch2 = await fetch(`${BASE_URL}/api/internal/run-scheduled?force=1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}`, 'Content-Type': 'application/json' },
    });
    expect(dispatch2.status).toBe(200);
    const list2 = await api(a.accessToken, 'GET', `/api/apps/${appId}/scheduled-tasks`);
    const ourTask2 = list2.json.tasks.find((t: any) => t.id === taskId);
    expect(ourTask2.runs.length).toBe(runsBefore);

    // Delete
    const delRes = await api(a.accessToken, 'DELETE', `/api/scheduled-tasks/${taskId}`);
    expect(delRes.status).toBe(200);
    const list3 = await api(a.accessToken, 'GET', `/api/apps/${appId}/scheduled-tasks`);
    expect(list3.json.tasks.find((t: any) => t.id === taskId)).toBeUndefined();
  });
});
