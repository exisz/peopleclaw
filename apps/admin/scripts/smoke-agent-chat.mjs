#!/usr/bin/env node
/**
 * PLANET-1671 smoke: create an agent chat session and read the streaming endpoint.
 *
 * Required env:
 * - PEOPLECLAW_SMOKE_BASE_URL (default http://localhost:3000)
 * - PEOPLECLAW_SMOKE_APP_ID
 * - PEOPLECLAW_SMOKE_AUTH_HEADER, e.g. "Bearer ..." or "Sudo $E2E_TEST_TOKEN"
 * Optional:
 * - PEOPLECLAW_SMOKE_SUDO_USER_ID (required when using Sudo auth)
 * - PEOPLECLAW_SMOKE_TENANT_SLUG
 * - PEOPLECLAW_SMOKE_MESSAGE
 */
const baseUrl = process.env.PEOPLECLAW_SMOKE_BASE_URL || 'http://localhost:3000';
const appId = process.env.PEOPLECLAW_SMOKE_APP_ID;
const auth = process.env.PEOPLECLAW_SMOKE_AUTH_HEADER;
const tenantSlug = process.env.PEOPLECLAW_SMOKE_TENANT_SLUG;
const sudoUserId = process.env.PEOPLECLAW_SMOKE_SUDO_USER_ID;
const message = process.env.PEOPLECLAW_SMOKE_MESSAGE || 'Say hello in one short sentence.';

if (!appId || !auth) {
  console.error('Missing PEOPLECLAW_SMOKE_APP_ID or PEOPLECLAW_SMOKE_AUTH_HEADER');
  process.exit(2);
}

const headers = {
  Authorization: auth,
  'Content-Type': 'application/json',
  ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
  ...(sudoUserId ? { 'x-sudo-user-id': sudoUserId } : {}),
};

async function jsonOrThrow(res) {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const sessionsUrl = `${baseUrl}/api/apps/${encodeURIComponent(appId)}/agent-sessions`;
const session = await jsonOrThrow(await fetch(sessionsUrl, {
  method: 'POST',
  headers,
  body: JSON.stringify({ title: 'PLANET-1671 smoke' }),
}));
console.log(`created session ${session.id}`);

const res = await fetch(`${sessionsUrl}/${encodeURIComponent(session.id)}/messages`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ message }),
});
if (!res.ok || !res.body) throw new Error(`${res.status} ${await res.text()}`);

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';
let text = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  const chunks = buf.split('\n\n');
  buf = chunks.pop() || '';
  for (const chunk of chunks) {
    const event = chunk.split('\n').find(line => line.startsWith('event: '))?.slice(7);
    const dataLine = chunk.split('\n').find(line => line.startsWith('data: '));
    if (!event || !dataLine) continue;
    const data = JSON.parse(dataLine.slice(6));
    if (event === 'text_delta') text += data.text || '';
    if (event === 'error') throw new Error(data.message || 'stream error');
    if (event === 'done') console.log('done');
  }
}
if (!text.trim()) throw new Error('No text_delta content received');
console.log(`assistant: ${text.trim().slice(0, 160)}`);
