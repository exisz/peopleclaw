#!/usr/bin/env node
/**
 * End-to-end acceptance test: creates a User (if needed), creates a Case
 * for the smoketest workflow (all auto), runs through engine → Shopify upload.
 * Prints product ID + admin URL.
 *
 * Usage: node scripts/run-demo-case.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
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

const { getPrisma } = await import('../api-dist/server/lib/prisma.js');
const { advanceCase, submitHumanStep } = await import('../api-dist/server/engine/executor.js');

const prisma = getPrisma();

// Ensure demo user exists
const user = await prisma.user.upsert({
  where: { logtoId: 'demo-acceptance-test' },
  create: { logtoId: 'demo-acceptance-test', email: 'demo@peopleclaw.test', credits: 100 },
  update: { credits: { increment: 0 } },
});
// top up credits if low
if (user.credits < 5) {
  await prisma.user.update({ where: { id: user.id }, data: { credits: 100 } });
}
console.log('[demo] user:', user.id, 'credits:', user.credits);

// Resolve default tenant (created by P3.8 migration / seed-demo) and ensure user
// is a member — the engine deducts credits from Tenant, not User.
const defaultTenant = await prisma.tenant.findUnique({ where: { slug: 'default' } });
if (!defaultTenant) throw new Error('default tenant missing — run seed-demo.mjs first');
await prisma.tenantUser.upsert({
  where: { tenantId_userId: { tenantId: defaultTenant.id, userId: user.id } },
  create: { tenantId: defaultTenant.id, userId: user.id, role: 'owner' },
  update: {},
});
if (defaultTenant.credits < 10) {
  await prisma.tenant.update({ where: { id: defaultTenant.id }, data: { credits: 100 } });
}
console.log('[demo] tenant:', defaultTenant.id, 'credits:', defaultTenant.credits);

// Get the demo (with-human-steps) workflow
const args = process.argv.slice(2);
const useFull = args.includes('--full');
const workflowId = useFull ? 'shopify-product-listing-demo' : 'shopify-auto-smoketest';
const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
if (!wf) throw new Error('workflow not found: ' + workflowId);
console.log('[demo] workflow:', wf.name);

// Create case
const c = await prisma.case.create({
  data: {
    workflowId,
    tenantId: defaultTenant.id,
    ownerId: user.id,
    title: `Acceptance Test ${new Date().toISOString().slice(0, 19)}`,
    payload: JSON.stringify({
      title: 'PeopleClaw Demo Mug',
      features: 'Ceramic, dishwasher safe, 350ml capacity, branded in AU',
      vendor: 'PeopleClaw',
      product_type: 'Drinkware',
    }),
  },
});
console.log('[demo] case created:', c.id);

let result = await advanceCase(c.id);
console.log('[demo] first advance →', result);

// If full workflow, simulate human approvals
let safety = 5;
while (result.status === 'waiting_human' && safety-- > 0) {
  console.log(`[demo] auto-approving human step ${result.lastStepId}`);
  result = await submitHumanStep(c.id, result.lastStepId, { approved: true, comment: 'auto' }, 'approve');
  console.log('[demo] →', result);
}

// Inspect final
const final = await prisma.case.findUnique({
  where: { id: c.id },
  include: { steps: { orderBy: { createdAt: 'asc' } } },
});
console.log('\n=== FINAL CASE ===');
console.log('id:', final.id);
console.log('status:', final.status);
console.log('steps:', final.steps.length);
for (const s of final.steps) {
  console.log(` - [${s.status}] ${s.stepId} (${s.stepType}) — output:`, s.output.slice(0, 200));
}

// Pull shopify product info
const shopifyStep = final.steps.find((s) => s.stepType === 'shopify_upload');
if (shopifyStep) {
  console.log('\n=== SHOPIFY OUTPUT ===');
  console.log(shopifyStep.output);
}

await prisma.$disconnect();
