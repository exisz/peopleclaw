#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

type CliConfig = { brokerUrl?: string; token?: string };

type Args = { command: string[]; flags: Record<string, string | boolean> };

const CONFIG_PATH = process.env.PCV_CONFIG ?? path.join(os.homedir(), '.config', 'peopleclaw-vercel', 'config.json');

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const [root, sub] = args.command;
  if (!root || root === 'help' || root === '--help' || root === '-h') return help();

  if (root === 'config') {
    if (sub === 'set') return configSet(args);
    if (sub === 'show') return printJson(await loadConfig(args));
  }
  if (root === 'login') return login(args);
  if (root === 'whoami') return brokerGet(args, '/whoami');
  if (root === 'projects' && sub === 'list') return brokerGet(args, `/projects${queryFromFlags(args, ['teamId', 'limit'])}`);
  if (root === 'deployments' && sub === 'list') return brokerGet(args, `/deployments${queryFromFlags(args, ['teamId', 'projectId', 'limit', 'state', 'target'])}`);
  if (root === 'admin' && sub === 'issue-key') return adminIssueKey(args);
  if (root === 'admin' && sub === 'tokens') return adminGet(args, '/admin/tokens');

  throw new Error(`Unknown command: ${args.command.join(' ')}`);
}

async function configSet(args: Args): Promise<void> {
  const current = await loadConfig(args, false);
  const next: CliConfig = { ...current };
  const brokerUrl = stringFlag(args, 'broker-url') || stringFlag(args, 'url');
  const token = stringFlag(args, 'token');
  if (brokerUrl) next.brokerUrl = normalizeBrokerUrl(brokerUrl);
  if (token) next.token = token;
  await saveConfig(next);
  printJson({ ok: true, path: CONFIG_PATH, brokerUrl: next.brokerUrl, token: next.token ? 'set' : 'unset' });
}

async function login(args: Args): Promise<void> {
  const brokerUrl = stringFlag(args, 'broker-url') || process.env.PCV_BROKER_URL;
  const token = stringFlag(args, 'token') || process.env.PCV_TOKEN;
  if (!brokerUrl || !token) throw new Error('login requires --broker-url and --token (or PCV_BROKER_URL / PCV_TOKEN)');
  await saveConfig({ brokerUrl: normalizeBrokerUrl(brokerUrl), token });
  await brokerGet(args, '/whoami', { brokerUrl: normalizeBrokerUrl(brokerUrl), token });
}

async function adminIssueKey(args: Args): Promise<void> {
  const config = await loadConfig(args);
  const adminSecret = stringFlag(args, 'admin-secret') || process.env.PCV_ADMIN_SECRET;
  if (!adminSecret) throw new Error('admin issue-key requires --admin-secret or PCV_ADMIN_SECRET');
  const body = {
    label: stringFlag(args, 'label') || 'customer',
    allowedRepos: csvFlag(args, 'repo'),
    allowedProjects: csvFlag(args, 'project'),
    allowedTeams: csvFlag(args, 'team'),
    expiresAt: stringFlag(args, 'expires-at') || null,
  };
  const res = await fetch(`${config.brokerUrl}/admin/tokens`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminSecret}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  await printResponse(res);
}

async function adminGet(args: Args, route: string): Promise<void> {
  const config = await loadConfig(args);
  const adminSecret = stringFlag(args, 'admin-secret') || process.env.PCV_ADMIN_SECRET;
  if (!adminSecret) throw new Error('admin command requires --admin-secret or PCV_ADMIN_SECRET');
  const res = await fetch(`${config.brokerUrl}${route}`, { headers: { authorization: `Bearer ${adminSecret}` } });
  await printResponse(res);
}

async function brokerGet(args: Args, route: string, override?: CliConfig): Promise<void> {
  const config = override ?? (await loadConfig(args));
  const res = await fetch(`${config.brokerUrl}${route}`, { headers: { authorization: `Bearer ${config.token}` } });
  await printResponse(res);
}

async function loadConfig(args: Args, requireToken = true): Promise<Required<CliConfig>> {
  let fileConfig: CliConfig = {};
  try {
    fileConfig = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8')) as CliConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const brokerUrl = stringFlag(args, 'broker-url') || process.env.PCV_BROKER_URL || fileConfig.brokerUrl;
  const token = stringFlag(args, 'token') || process.env.PCV_TOKEN || fileConfig.token;
  if (!brokerUrl) throw new Error('Missing broker URL. Use --broker-url, PCV_BROKER_URL, or `pcv config set --broker-url ...`.');
  if (requireToken && !token) throw new Error('Missing customer token. Use --token, PCV_TOKEN, or `pcv login`.');
  return { brokerUrl: normalizeBrokerUrl(brokerUrl), token: token ?? '' };
}

async function saveConfig(config: CliConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(CONFIG_PATH, 0o600).catch(() => undefined);
}

function parseArgs(argv: string[]): Args {
  const command: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const eq = item.indexOf('=');
      if (eq >= 0) flags[item.slice(2, eq)] = item.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[item.slice(2)] = argv[++i];
      else flags[item.slice(2)] = true;
    } else {
      command.push(item);
    }
  }
  return { command, flags };
}

function stringFlag(args: Args, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === 'string' ? value : undefined;
}

function csvFlag(args: Args, name: string): string[] {
  const value = args.flags[name];
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function queryFromFlags(args: Args, names: string[]): string {
  const params = new URLSearchParams();
  for (const name of names) {
    const value = stringFlag(args, name);
    if (value) params.set(name, value);
  }
  const raw = params.toString();
  return raw ? `?${raw}` : '';
}

function normalizeBrokerUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

async function printResponse(res: Response): Promise<void> {
  const text = await res.text();
  if (text) process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
  if (!res.ok) process.exitCode = 1;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help(): void {
  console.log(`peopleclaw-vercel CLI (pcv)

Usage:
  pcv config set --broker-url URL [--token TOKEN]
  pcv login --broker-url URL --token TOKEN
  pcv whoami [--broker-url URL] [--token TOKEN]
  pcv projects list [--limit 20]
  pcv deployments list [--projectId NAME_OR_ID] [--limit 20]
  pcv admin issue-key --admin-secret SECRET --label LABEL --project skin-spirit --repo exisz/skin-spirit
  pcv admin tokens --admin-secret SECRET

Environment:
  PCV_BROKER_URL, PCV_TOKEN, PCV_ADMIN_SECRET, PCV_CONFIG
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
