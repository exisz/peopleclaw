#!/usr/bin/env node
/**
 * PLANET-1045: Switch Logto http-email connector to the PeopleClaw bridge.
 *
 * Prerequisites:
 *   1. Vercel has RESEND_API_KEY + LOGTO_EMAIL_WEBHOOK_SECRET set
 *   2. Vercel has deployed the latest commit (bridge endpoint live)
 *
 * Usage:
 *   node scripts/switch-logto-email-to-bridge.mjs --secret=$LOGTO_EMAIL_WEBHOOK_SECRET
 *
 * Env needed (from ~/.openclaw/.env or shell):
 *   LOGTO_M2M_APP_ID, LOGTO_M2M_APP_SECRET, LOGTO_ENDPOINT, LOGTO_MGMT_API_RESOURCE
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import os from 'node:os';

// Load ~/.openclaw/.env if it exists
try {
  const envPath = resolve(os.homedir(), '.openclaw', '.env');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* file may not exist */ }

const { values } = parseArgs({
  options: {
    secret: { type: 'string', default: process.env.LOGTO_EMAIL_WEBHOOK_SECRET ?? '' },
    'connector-id': { type: 'string', default: 'v2gp84ya1yje' },
    'bridge-url': { type: 'string', default: 'https://app.peopleclaw.rollersoft.com.au/api/webhooks/logto-email' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: false,
});

const CONNECTOR_ID = values['connector-id'];
const BRIDGE_URL = values['bridge-url'];
const WEBHOOK_SECRET = values.secret;
const DRY_RUN = values['dry-run'];

const LOGTO_ENDPOINT = process.env.LOGTO_ENDPOINT;
const M2M_APP_ID = process.env.LOGTO_M2M_APP_ID;
const M2M_APP_SECRET = process.env.LOGTO_M2M_APP_SECRET;
const MGMT_API_RESOURCE = process.env.LOGTO_MGMT_API_RESOURCE ?? `${LOGTO_ENDPOINT}/api`;

if (!WEBHOOK_SECRET) {
  console.error('Error: --secret or LOGTO_EMAIL_WEBHOOK_SECRET required');
  process.exit(1);
}
if (!LOGTO_ENDPOINT || !M2M_APP_ID || !M2M_APP_SECRET) {
  console.error('Error: LOGTO_ENDPOINT, LOGTO_M2M_APP_ID, LOGTO_M2M_APP_SECRET must be set');
  process.exit(1);
}

async function getM2MToken() {
  const creds = Buffer.from(`${M2M_APP_ID}:${M2M_APP_SECRET}`).toString('base64');
  const res = await fetch(`${LOGTO_ENDPOINT}/oidc/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource: MGMT_API_RESOURCE,
      scope: 'all',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token fetch failed ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

console.log(`\n🔧 Logto Connector Switch — PLANET-1045`);
console.log(`   Connector ID : ${CONNECTOR_ID}`);
console.log(`   Bridge URL   : ${BRIDGE_URL}`);
if (DRY_RUN) console.log('   [DRY RUN — no changes will be made]\n');

const token = await getM2MToken();
console.log('   ✅ M2M token obtained\n');

const patchBody = {
  config: {
    endpoint: BRIDGE_URL,
    authorization: `Bearer ${WEBHOOK_SECRET}`,
  },
};

console.log('Patching connector config:');
console.log(JSON.stringify(patchBody, null, 2));

if (!DRY_RUN) {
  const res = await fetch(`${LOGTO_ENDPOINT}/api/connectors/${CONNECTOR_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patchBody),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`\n❌ PATCH failed ${res.status}:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log(`\n✅ Connector updated successfully!`);
  console.log(`   Endpoint: ${data.config?.endpoint}`);
  console.log('\nNext: ask Elen to retry registration at https://app.peopleclaw.rollersoft.com.au');
} else {
  console.log('\n[dry-run] Skipped PATCH. Re-run without --dry-run when ready.');
}
