/**
 * PLANET-1459: App-to-App invoke via ctx.callApp + isExported toggle.
 *
 * E2E (API-driven, no UI):
 *   - Mint tenant A → create App A with exported BACKEND "exporter"
 *   - Create App B with BACKEND "caller" that uses ctx.callApp
 *   - POST /run on caller → assert result echoes exporter payload + input
 *   - Cross-tenant: mint tenant B → POST /invoke against tenant A's exporter → 403
 *   - Non-exported: flip isExported=false on exporter → POST /invoke → 403
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.peopleclaw.rollersoft.com.au';
const E2E_SECRET = process.env.E2E_SECRET ?? '';

interface MintResult {
  accessToken: string;
  sub: string;
}

async function mintToken(email: string): Promise<MintResult> {
  const res = await fetch(`${BASE_URL}/api/internal/e2e-mint-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-E2E-Secret': E2E_SECRET },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`mint failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<MintResult>;
}

async function api<T = any>(token: string, method: string, path: string, body?: any): Promise<{ status: number; json: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _raw: text }; }
  return { status: res.status, json: json as T };
}

async function runAndCollect(token: string, componentId: string, body: any): Promise<{ status: number; result: any; error?: any; probes: any[] }> {
  const res = await fetch(`${BASE_URL}/api/components/${componentId}/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status !== 200) {
    return { status: res.status, result: null, probes: [], error: await res.text() };
  }
  const text = await res.text();
  // Parse SSE events
  let result: any = null;
  let error: any = null;
  const probes: any[] = [];
  for (const block of text.split('\n\n')) {
    if (!block.trim()) continue;
    const lines = block.split('\n');
    let event = 'message';
    let data = '';
    for (const ln of lines) {
      if (ln.startsWith('event:')) event = ln.slice(6).trim();
      else if (ln.startsWith('data:')) data += ln.slice(5).trim();
    }
    try {
      const parsed = JSON.parse(data);
      if (event === 'result') result = parsed;
      else if (event === 'error') error = parsed;
      else if (event === 'probe') probes.push(parsed);
    } catch { /* ignore */ }
  }
  return { status: 200, result, error, probes };
}

const EXPORTER_CODE = `
export async function run(input, ctx) {
  await peopleClaw.nodeEntry('exporter:enter');
  return { msg: 'hello from A', got: ctx.input ?? input };
}
`;

function callerCode(targetAppId: string, exporterId: string): string {
  // Inline the IDs so the sandbox doesn't need to read them from anywhere else.
  return `
export async function run(input, ctx) {
  await peopleClaw.nodeEntry('caller:before');
  const r = await ctx.callApp(${JSON.stringify(targetAppId)}, ${JSON.stringify(exporterId)}, { greet: 'world' });
  await peopleClaw.nodeEntry('caller:after');
  return { invoked: r };
}
`;
}

test.describe('PLANET-1459: App-to-App invoke', () => {
  test.skip(!E2E_SECRET, 'E2E_SECRET not set');

  test('exported component is callable from another app in same tenant; cross-tenant 403; toggle gates', async () => {
    test.setTimeout(120_000);

    // --- Tenant A ---
    const ts = Date.now();
    const emailA = `e2e-1459-a-${ts}@peopleclaw.test`;
    const a = await mintToken(emailA);

    // App A
    const appARes = await api(a.accessToken, 'POST', '/api/apps', { name: `1459-A-${ts}` });
    expect(appARes.status, JSON.stringify(appARes.json)).toBe(200);
    const appAId = appARes.json.app.id as string;

    // Exporter component (BACKEND). Create with isExported=true via the new endpoint.
    const expRes = await api(a.accessToken, 'POST', `/api/apps/${appAId}/components`, {
      name: 'exporter',
      type: 'BACKEND',
      code: EXPORTER_CODE,
      isExported: true,
    });
    expect(expRes.status, JSON.stringify(expRes.json)).toBe(200);
    const exporterId = expRes.json.component.id as string;

    // App B (same tenant)
    const appBRes = await api(a.accessToken, 'POST', '/api/apps', { name: `1459-B-${ts}` });
    expect(appBRes.status).toBe(200);
    const appBId = appBRes.json.app.id as string;

    const callerRes = await api(a.accessToken, 'POST', `/api/apps/${appBId}/components`, {
      name: 'caller',
      type: 'BACKEND',
      code: callerCode(appAId, exporterId),
    });
    expect(callerRes.status, JSON.stringify(callerRes.json)).toBe(200);
    const callerId = callerRes.json.component.id as string;

    // Run caller: should invoke exporter and return its payload.
    const runOut = await runAndCollect(a.accessToken, callerId, {});
    expect(runOut.status).toBe(200);
    expect(runOut.error, JSON.stringify(runOut.error)).toBeNull();
    expect(runOut.result).not.toBeNull();
    expect(runOut.result.invoked).toBeDefined();
    expect(runOut.result.invoked.msg).toBe('hello from A');
    expect(runOut.result.invoked.got).toBeDefined();
    expect(runOut.result.invoked.got.greet).toBe('world');

    // --- Direct /invoke endpoint, same tenant: should succeed ---
    const directRes = await api(a.accessToken, 'POST', `/api/apps/${appAId}/invoke/${exporterId}`, { greet: 'direct' });
    expect(directRes.status).toBe(200);
    expect(directRes.json.ok).toBe(true);
    expect(directRes.json.result.msg).toBe('hello from A');
    expect(directRes.json.result.got.greet).toBe('direct');

    // --- Cross-tenant: mint different email → fresh tenant ---
    const emailX = `e2e-1459-x-${ts}@peopleclaw.test`;
    const x = await mintToken(emailX);
    const crossRes = await api(x.accessToken, 'POST', `/api/apps/${appAId}/invoke/${exporterId}`, { greet: 'cross' });
    expect(crossRes.status).toBe(403);
    expect(crossRes.json.ok).toBe(false);

    // --- Toggle isExported=false → invoke should 403 ---
    const toggleOff = await api(a.accessToken, 'PATCH', `/api/components/${exporterId}/export`, { isExported: false });
    expect(toggleOff.status).toBe(200);
    expect(toggleOff.json.component.isExported).toBe(false);

    const offRes = await api(a.accessToken, 'POST', `/api/apps/${appAId}/invoke/${exporterId}`, { greet: 'off' });
    expect(offRes.status).toBe(403);

    // ctx.callApp should also fail now.
    const runOff = await runAndCollect(a.accessToken, callerId, {});
    expect(runOff.error).not.toBeNull();
    expect(String(runOff.error?.message ?? '')).toMatch(/not exported|isExported/i);

    // Re-enable, confirm green again.
    const toggleOn = await api(a.accessToken, 'PATCH', `/api/components/${exporterId}/export`, { isExported: true });
    expect(toggleOn.status).toBe(200);
    expect(toggleOn.json.component.isExported).toBe(true);

    const runOn = await runAndCollect(a.accessToken, callerId, {});
    expect(runOn.error, JSON.stringify(runOn.error)).toBeNull();
    expect(runOn.result.invoked.msg).toBe('hello from A');
  });
});
