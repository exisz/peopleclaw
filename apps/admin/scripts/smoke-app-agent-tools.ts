import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { getPrisma } from '../src/server/lib/prisma.js';
import { executeAppAgentTool } from '../src/server/lib/appAgentTools.js';

const dir = mkdtempSync(join(tmpdir(), 'peopleclaw-app-agent-'));
process.env.LOCAL_DATABASE_URL = `file:${join(dir, 'smoke.db')}`;
process.env.TURSO_DATABASE_URL = '';
process.env.TURSO_AUTH_TOKEN = '';

try {
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    env: process.env,
  });

  const prisma = getPrisma();
  const tenant = await prisma.tenant.create({ data: { name: 'Smoke Tenant', slug: `smoke-${Date.now()}` } });
  const app = await prisma.app.create({ data: { tenantId: tenant.id, name: 'Smoke App', description: 'App-agent tool smoke test' } });
  const ctx = { tenantId: tenant.id, appId: app.id };

  const created = await executeAppAgentTool(ctx, {
    type: 'toolCall',
    id: 'call-create',
    name: 'create_app_component',
    arguments: { kind: 'page', name: 'Smoke Page', code: 'export default function SmokePage(){ return <div>Smoke</div> }' },
  });
  if (created.message.isError) throw new Error(`create_app_component failed: ${created.summary}`);

  const listed = await executeAppAgentTool(ctx, {
    type: 'toolCall',
    id: 'call-list',
    name: 'list_app_modules',
    arguments: { includeSourcePreview: true },
  });
  if (listed.message.isError) throw new Error(`list_app_modules failed: ${listed.summary}`);
  const listedAny = listed.result as any;
  if (!listedAny.pages?.some((item: any) => item.name === 'Smoke Page')) throw new Error('created page was not listed');

  const componentId = listedAny.pages.find((item: any) => item.name === 'Smoke Page').id;
  const updated = await executeAppAgentTool(ctx, {
    type: 'toolCall',
    id: 'call-update',
    name: 'update_app_component',
    arguments: { componentId, name: 'Smoke Page Updated', isExported: true },
  });
  if (updated.message.isError) throw new Error(`update_app_component failed: ${updated.summary}`);

  const inspected = await executeAppAgentTool(ctx, {
    type: 'toolCall',
    id: 'call-inspect',
    name: 'inspect_current_app',
    arguments: {},
  });
  if (inspected.message.isError) throw new Error(`inspect_current_app failed: ${inspected.summary}`);

  await prisma.$disconnect();
  console.log('[smoke-app-agent-tools] ok:', created.summary, listed.summary, updated.summary, inspected.summary);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
