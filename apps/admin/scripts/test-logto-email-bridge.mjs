#!/usr/bin/env node
/**
 * PLANET-1045: Test the Logto email bridge by simulating all 4 email types.
 *
 * Usage:
 *   node apps/admin/scripts/test-logto-email-bridge.mjs --to=you@example.com
 *   node apps/admin/scripts/test-logto-email-bridge.mjs --to=you@example.com --target=https://app.peopleclaw.rollersoft.com.au --secret=abc123
 */

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    target: { type: 'string', default: 'http://localhost:3000' },
    secret: { type: 'string', default: process.env.LOGTO_EMAIL_WEBHOOK_SECRET ?? '' },
    to: { type: 'string' },
  },
  strict: false,
});

if (!values.to) {
  console.error('Error: --to=<email> is required');
  process.exit(1);
}

const BASE = values.target;
const SECRET = values.secret;
const TO = values.to;

if (!SECRET) {
  console.error('Error: --secret or LOGTO_EMAIL_WEBHOOK_SECRET env required');
  process.exit(1);
}

const TYPES = ['Register', 'SignIn', 'ForgotPassword', 'Generic'];

async function healthCheck() {
  const res = await fetch(`${BASE}/api/webhooks/logto-email/health`);
  const data = await res.json();
  console.log('Health:', JSON.stringify(data));
  if (!data.hasResendKey) console.warn('  ⚠️  RESEND_API_KEY not set on server');
  if (!data.hasWebhookSecret) console.warn('  ⚠️  LOGTO_EMAIL_WEBHOOK_SECRET not set on server');
}

async function sendTest(type) {
  const body = {
    to: TO,
    type,
    payload: { code: '123456' },
  };

  const res = await fetch(`${BASE}/api/webhooks/logto-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const icon = res.ok ? '✅' : '❌';
  console.log(`${icon} [${type}] HTTP ${res.status}:`, JSON.stringify(data));
  return res.ok;
}

console.log(`\n🔗 Target: ${BASE}`);
console.log(`📬 Sending to: ${TO}\n`);

await healthCheck();
console.log('');

let passed = 0;
for (const type of TYPES) {
  const ok = await sendTest(type);
  if (ok) passed++;
}

console.log(`\n${passed}/${TYPES.length} tests passed`);
if (passed < TYPES.length) process.exit(1);
