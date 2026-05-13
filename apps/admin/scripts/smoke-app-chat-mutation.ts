import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPrisma } from '../src/server/lib/prisma.js';
import { executeAppAgentTool } from '../src/server/lib/appAgentTools.js';
import { appendAgentMessage, createAgentSession, readAgentSession } from '../src/server/lib/agentSessions.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseToolContent(text: string): any {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`tool result content was not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'peopleclaw-app-chat-mutation-'));
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
  const suffix = Date.now();
  const tenant = await prisma.tenant.create({ data: { name: 'App Chat Smoke Tenant', slug: `app-chat-smoke-${suffix}` } });
  const app = await prisma.app.create({
    data: {
      tenantId: tenant.id,
      name: 'App Chat Smoke App',
      description: 'PLANET-1675 server smoke proving app-agent mutation tools persist components',
    },
  });

  const session = await createAgentSession({ tenantId: tenant.id, appId: app.id, title: 'PLANET-1675 app chat mutation smoke' });
  const userPrompt = 'Add a new public dashboard page called Smoke Metrics to this App.';
  await appendAgentMessage(tenant.id, app.id, session.id, { role: 'user', content: userPrompt });

  const toolResult = await executeAppAgentTool(
    { tenantId: tenant.id, appId: app.id },
    {
      type: 'toolCall',
      id: 'planet-1675-create-smoke-metrics-page',
      name: 'create_app_component',
      arguments: {
        kind: 'page',
        name: 'Smoke Metrics',
        code: 'export default function SmokeMetrics(){ return <main><h1>Smoke Metrics</h1></main> }',
        icon: 'chart',
        canvasX: 120,
        canvasY: 80,
      },
    },
  );

  assert(!toolResult.message.isError, `create_app_component failed: ${toolResult.summary}`);
  assert(toolResult.toolName === 'create_app_component', 'tool result used unexpected tool name');
  assert(toolResult.message.role === 'toolResult', 'tool result message did not use toolResult role');
  assert(toolResult.message.toolCallId === 'planet-1675-create-smoke-metrics-page', 'tool result did not preserve tool call id');
  const messagePayload = parseToolContent(toolResult.message.content[0]?.type === 'text' ? toolResult.message.content[0].text : '');
  assert(messagePayload.ok === true, 'tool result JSON did not report ok=true');
  assert(messagePayload.result?.component?.name === 'Smoke Metrics', 'tool result JSON missing created component name');
  assert(messagePayload.result?.component?.kind === 'page', 'tool result JSON did not classify created component as page');

  await appendAgentMessage(tenant.id, app.id, session.id, {
    role: 'tool',
    toolName: toolResult.toolName,
    content: toolResult.summary,
  });
  await appendAgentMessage(tenant.id, app.id, session.id, {
    role: 'assistant',
    content: `Created the Smoke Metrics page in this App. ${toolResult.summary}`,
  });

  const persisted = await prisma.component.findFirst({
    where: { appId: app.id, app: { tenantId: tenant.id }, name: 'Smoke Metrics' },
  });
  assert(persisted, 'created component was not persisted');
  assert(persisted.type === 'FRONTEND', 'created page did not default to FRONTEND component type');
  assert(persisted.runtime === 'PEOPLECLAW_CLOUD', 'created page did not default to PEOPLECLAW_CLOUD runtime');
  assert(persisted.isExported === true, 'created page was not exported into the app shell');
  assert(persisted.code.includes('SmokeMetrics'), 'created component source was not persisted');

  const listed = await executeAppAgentTool(
    { tenantId: tenant.id, appId: app.id },
    { type: 'toolCall', id: 'planet-1675-list-modules', name: 'list_app_modules', arguments: { includeSourcePreview: true } },
  );
  assert(!listed.message.isError, `list_app_modules failed: ${listed.summary}`);
  const listResult = listed.result as any;
  assert(listResult.pages?.some((item: any) => item.id === persisted.id && item.name === 'Smoke Metrics'), 'created page was not visible through list_app_modules');

  const storedSession = await readAgentSession(tenant.id, app.id, session.id);
  assert(storedSession, 'agent session was not persisted');
  assert(storedSession.messageCount === 3, `expected 3 persisted chat messages, got ${storedSession.messageCount}`);
  assert(storedSession.messages.some(m => m.role === 'user' && m.content === userPrompt), 'session did not record user prompt');
  assert(storedSession.messages.some(m => m.role === 'tool' && m.toolName === 'create_app_component' && m.content.includes('Smoke Metrics')), 'session did not record create_app_component tool result');
  assert(storedSession.messages.some(m => m.role === 'assistant' && m.content.includes('Smoke Metrics')), 'session did not record assistant summary');

  await prisma.$disconnect();
  console.log('[smoke-app-chat-mutation] ok:', {
    appId: app.id,
    sessionId: session.id,
    componentId: persisted.id,
    summary: toolResult.summary,
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
