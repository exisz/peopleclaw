#!/usr/bin/env node
/**
 * Seed the Workflow table with the demo workflow and a few derived from
 * client/data/workflows.ts (best-effort mapping — the rich UI shapes don't
 * 1:1 map to engine kind=auto/human, so we just store them as inert defs
 * for browsing). The PRIMARY engine workflow is the demo one.
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.TURSO_DATABASE_URL) {
  for (const p of [
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '..', '..', '.env.local'),
  ]) {
    try {
      const txt = readFileSync(p, 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\n]*)"?$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
      break;
    } catch {}
  }
}

const c = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const demoDef = {
  nodes: [
    { id: 's1', type: 'create_case', kind: 'auto', handler: 'create_case', config: { fields: ['title', 'features', 'vendor'] } },
    { id: 's2', type: 'human:review', kind: 'human', config: { prompt: 'Review the product input' } },
    { id: 's3', type: 'ai_description', kind: 'auto', handler: 'ai.product_description', config: {} },
    { id: 's4', type: 'human:approve_copy', kind: 'human', config: { prompt: 'Approve the AI-generated copy?' } },
    { id: 's5', type: 'shopify_upload', kind: 'auto', handler: 'shopify.list_product', config: {} },
  ],
  edges: [
    { source: 's1', target: 's2' },
    { source: 's2', target: 's3' },
    { source: 's3', target: 's4' },
    { source: 's4', target: 's5' },
  ],
};

const workflows = [
  // PLANET-1043 — Ecommerce entry workflow (image + price only entry node)
  {
    id: 'ecommerce-image-price-entry-demo',
    name: 'Ecommerce Quick List (Image + Price)',
    category: 'E-commerce',
    description: 'Start with just a product image and price — no name or description needed. AI generates copy then lists to Shopify.',
    icon: '🖴',
    definition: JSON.stringify({
      description: 'Start with just a product image and price — no name or description needed.',
      icon: '🖴',
      nodes: [
        { id: 's1', type: 'ecommerce.entry', kind: 'auto', handler: 'ecommerce.entry', config: { fields: ['image', 'price'] } },
        { id: 's2', type: 'ai_description', kind: 'auto', handler: 'ai.product_description', config: {} },
        { id: 's3', type: 'human:approve_copy', kind: 'human', config: { prompt: 'Review AI-generated copy before listing' } },
        { id: 's4', type: 'shopify_upload', kind: 'auto', handler: 'shopify.list_product', config: {} },
      ],
      edges: [
        { source: 's1', target: 's2' },
        { source: 's2', target: 's3' },
        { source: 's3', target: 's4' },
      ],
    }),
  },
  {
    id: 'shopify-product-listing-demo',
    name: 'Shopify Product Listing (PeopleClaw Demo)',
    category: 'E-commerce',
    definition: JSON.stringify(demoDef),
  },
  // A pure-auto smoke test workflow (no human steps) for end-to-end verification
  {
    id: 'shopify-auto-smoketest',
    name: 'Shopify Auto Smoke Test',
    category: 'E-commerce',
    definition: JSON.stringify({
      nodes: [
        { id: 's1', type: 'create_case', kind: 'auto', handler: 'create_case', config: {} },
        { id: 's2', type: 'ai_description', kind: 'auto', handler: 'ai.product_description', config: {} },
        { id: 's3', type: 'shopify_upload', kind: 'auto', handler: 'shopify.list_product', config: {} },
      ],
      edges: [
        { source: 's1', target: 's2' },
        { source: 's2', target: 's3' },
      ],
    }),
  },
];

async function main() {
  for (const w of workflows) {
    await c.execute({
      sql: `INSERT INTO Workflow (id, name, category, definition, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              category = excluded.category,
              definition = excluded.definition,
              updatedAt = CURRENT_TIMESTAMP`,
      args: [w.id, w.name, w.category, w.definition],
    });
    console.log('seeded:', w.id);
  }
  const r = await c.execute('SELECT id, name FROM Workflow ORDER BY createdAt');
  console.log('total workflows:', r.rows.length);
  for (const row of r.rows) console.log(' -', row.id, '|', row.name);
}

main().catch((e) => { console.error(e); process.exit(1); });
