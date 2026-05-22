import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const adminRoot = resolve(here, '..');
const cliBin = resolve(repoRoot, 'packages/cli/dist/index.js');

const liveBaseUrl = process.env.PEOPLECLAW_E2E_BASE_URL ?? process.env.PEOPLECLAW_BASE_URL;
const liveApiKey = process.env.PEOPLECLAW_E2E_API_KEY ?? process.env.PEOPLECLAW_API_KEY;
const liveAppId = process.env.PEOPLECLAW_E2E_APP_ID ?? process.env.PEOPLECLAW_APP_ID;
const mode = process.env.PEOPLECLAW_E2E_MODE ?? (liveBaseUrl && liveApiKey && liveAppId ? 'live' : 'local');
const confirmMutation = process.env.PEOPLECLAW_E2E_CONFIRM_MUTATION === '1';
const includeChat = process.env.PEOPLECLAW_E2E_INCLUDE_CHAT === '1';

if (!existsSync(cliBin)) {
  throw new Error(`PeopleClaw CLI build missing at ${cliBin}. Run: pnpm --filter @peopleclaw/cli build`);
}

type CliContext = {
  baseUrl: string;
  apiKey: string;
  appId: string;
  cleanup: () => Promise<void> | void;
};

async function runCli(args: string[], env: Record<string, string>, opts: { allowFailure?: boolean } = {}) {
  console.error(`[external-cli-smoke] peopleclaw ${args.join(' ')}`);
  try {
    const { stdout } = await execFileAsync(process.execPath, [cliBin, ...args, '--json'], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    if (!opts.allowFailure) throw error;
    const stdout = (error as { stdout?: string }).stdout ?? '{}';
    return JSON.parse(stdout);
  }
}

async function createLocalContext(): Promise<CliContext> {
  const tmp = mkdtempSync(join(tmpdir(), 'peopleclaw-external-cli-e2e-'));
  const dbPath = join(tmp, 'smoke.db');
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  process.env.DATABASE_URL = process.env.LOCAL_DATABASE_URL;
  process.env.E2E_SECRET = 'external-cli-e2e-secret';
  process.env.NODE_ENV = 'test';
  process.env.TURSO_DATABASE_URL = '';
  process.env.TURSO_AUTH_TOKEN = '';

  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate'], {
    cwd: adminRoot,
    env: process.env,
    stdio: 'ignore',
  });

  const [{ createApp }, { getPrisma }, { createExternalAgentToken }] = await Promise.all([
    import('../src/server/app.js'),
    import('../src/server/lib/prisma.js'),
    import('../src/server/lib/externalAgentTokens.js'),
  ]);

  const prisma = getPrisma();
  const tenant = await prisma.tenant.create({ data: { name: 'External CLI E2E Tenant', slug: `external-cli-e2e-${Date.now()}` } });
  const appRecord = await prisma.app.create({ data: { tenantId: tenant.id, name: 'External CLI E2E App', description: 'Codex-like CLI smoke target' } });
  const tokenParts = createExternalAgentToken();
  await prisma.externalAgentKey.create({
    data: {
      tenantId: tenant.id,
      appId: appRecord.id,
      name: 'Codex clean env smoke',
      prefix: tokenParts.prefix,
      tokenHash: tokenParts.tokenHash,
      scopes: JSON.stringify(['agent:read', 'app:read', 'component:read', 'component:write']),
    },
  });

  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  assert(address && typeof address === 'object');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    apiKey: tokenParts.token,
    appId: appRecord.id,
    cleanup: async () => {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      await prisma.$disconnect();
      rmSync(tmp, { recursive: true, force: true });
    },
  };
}

function createLiveContext(): CliContext {
  if (!liveBaseUrl || !liveApiKey || !liveAppId) {
    throw new Error('Live mode requires PEOPLECLAW_E2E_BASE_URL, PEOPLECLAW_E2E_API_KEY, and PEOPLECLAW_E2E_APP_ID (or PEOPLECLAW_BASE_URL/API_KEY/APP_ID).');
  }
  return { baseUrl: liveBaseUrl, apiKey: liveApiKey, appId: liveAppId, cleanup: () => {} };
}

async function main() {
  const ctx = mode === 'live' ? createLiveContext() : await createLocalContext();
  const configDir = mkdtempSync(join(tmpdir(), 'peopleclaw-cli-config-'));
  const cliEnv = { PEOPLECLAW_CONFIG: join(configDir, 'config.json') };

  try {
      console.error(`[external-cli-smoke] mode=${mode} baseUrl=${ctx.baseUrl} appId=${ctx.appId} confirmMutation=${confirmMutation}`);
    const configured = await runCli(['configure', '--base-url', ctx.baseUrl, '--api-key', ctx.apiKey], cliEnv);
    assert.equal(configured.ok, true);
    assert.equal(configured.baseUrl, ctx.baseUrl);

    const whoami = await runCli(['whoami'], cliEnv);
    assert.equal(typeof whoami.externalAgent?.keyId, 'string');
    assert.equal(whoami.externalAgent?.appId, ctx.appId);

    const appsList = await runCli(['apps', 'list'], cliEnv);
    assert.equal(Array.isArray(appsList.apps), true);
    assert.equal(appsList.apps.some((item: any) => item.id === ctx.appId), true, 'apps list includes scoped target app');

    const beforeInspect = await runCli(['app', 'inspect', ctx.appId], cliEnv);
    assert.equal(beforeInspect.app?.id, ctx.appId);
    assert.equal(beforeInspect.safety?.rawSql, false);
    assert.equal(beforeInspect.safety?.secretsPlaintext, false);
    const beforeCount = Number(beforeInspect.counts?.components ?? 0);

    const dryRun = await runCli([
      'app',
      'action',
      ctx.appId,
      'create_app_component',
      '--args',
      JSON.stringify({ kind: 'page', name: `CLI Dry Run ${Date.now()}` }),
    ], cliEnv);
    assert.equal(dryRun.ok, true);
    assert.equal(dryRun.audit?.dryRun, true);
    assert.equal(dryRun.decision?.dryRun, true);

    const afterDryRunInspect = await runCli(['app', 'inspect', ctx.appId], cliEnv);
    assert.equal(Number(afterDryRunInspect.counts?.components ?? 0), beforeCount, 'dry-run action must not mutate components');

    let mutationComponentId: string | undefined;
    if (confirmMutation) {
      const mutation = await runCli([
        'app',
        'action',
        ctx.appId,
        'create_app_component',
        '--confirm',
        '--dry-run=false',
        '--args',
        JSON.stringify({ kind: 'page', name: `CLI Confirmed ${Date.now()}` }),
      ], cliEnv);
      assert.equal(mutation.ok, true, JSON.stringify(mutation));
      assert.equal(mutation.audit?.dryRun, false);
      mutationComponentId = mutation.action?.result?.component?.id;
      assert.equal(typeof mutationComponentId, 'string');

      const afterMutationInspect = await runCli(['app', 'inspect', ctx.appId], cliEnv);
      assert.equal(Number(afterMutationInspect.counts?.components ?? 0), beforeCount + 1, 'confirmed safe mutation creates one component');
    }

    if (includeChat) {
      const chat = await runCli(['app', 'chat', ctx.appId, 'Suggest a safe contacts page, but do not mutate anything.'], cliEnv);
      assert.equal(chat.ok, true);
      assert.equal(chat.audit?.dryRun, true);
      assert.match(String(chat.response), /Dry run only/);
    }

    console.log(JSON.stringify({
      ok: true,
      mode,
      baseUrl: ctx.baseUrl,
      appId: ctx.appId,
      dryRunVerified: true,
      confirmedMutationVerified: confirmMutation,
      mutationComponentId,
      chatVerified: includeChat,
    }, null, 2));
  } finally {
    rmSync(configDir, { recursive: true, force: true });
    await ctx.cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
