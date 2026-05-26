#!/usr/bin/env node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const DEFAULT_BASE_URL = 'https://app.peopleclaw.rollersoft.com.au';
const CONFIG_PATH = process.env.PEOPLECLAW_CONFIG || path.join(os.homedir(), '.peopleclaw', 'config.json');

type Config = { baseUrl?: string; apiKey?: string };
type Json = Record<string, unknown>;

function loadConfig(): Config {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Config; } catch { return {}; }
}

function saveConfig(config: Config): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function parseFlags(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const [rawKey, rawValue] = arg.slice(2).split('=', 2);
      const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (rawValue !== undefined) flags[key] = rawValue;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) flags[key] = argv[++i];
      else flags[key] = true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function textFlag(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function boolFlag(value: string | boolean | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  return Boolean(value);
}

function endpoint(baseUrl: string, apiPath: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const pathPart = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return base.endsWith('/api') ? `${base}${pathPart}` : `${base}/api${pathPart}`;
}

function runtime(flags: Record<string, string | boolean>) {
  const config = loadConfig();
  const baseUrl = textFlag(flags.baseUrl) ?? process.env.PEOPLECLAW_BASE_URL ?? config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = textFlag(flags.apiKey) ?? process.env.PEOPLECLAW_API_KEY ?? config.apiKey;
  return { config, baseUrl, apiKey };
}

async function request(apiPath: string, options: { method?: string; body?: unknown; flags: Record<string, string | boolean> }) {
  const { baseUrl, apiKey } = runtime(options.flags);
  if (!apiKey) throw new Error('Missing API key. Run `peopleclaw configure --api-key pc_m2m_...` or set PEOPLECLAW_API_KEY.');
  const res = await fetch(endpoint(baseUrl, apiPath), {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const error = new Error(`PeopleClaw API ${res.status}: ${typeof body === 'object' && body && 'error' in body ? (body as any).error : text}`) as Error & { status?: number; body?: unknown };
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return body;
}

function print(data: unknown, flags: Record<string, string | boolean>, fallback?: string): void {
  if (flags.json || !fallback) console.log(JSON.stringify(data, null, 2));
  else console.log(fallback);
}

function fileEntries(body: unknown): Record<string, string> {
  const source = (body as any)?.appTree?.files ?? (body as any)?.artifact?.files ?? (body as any)?.files;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const entries: Record<string, string> = {};
  for (const [name, value] of Object.entries(source as Record<string, unknown>)) {
    if (typeof value === 'string') entries[name] = value;
    else if (value !== undefined) entries[name] = JSON.stringify(value, null, 2) + '\n';
  }
  return entries;
}

function safeWriteAppTree(root: string, files: Record<string, string>): string[] {
  const written: string[] = [];
  const resolvedRoot = path.resolve(root);
  for (const [relativePath, contents] of Object.entries(files)) {
    const cleanRelativePath = relativePath.replace(/^\/+/, '');
    const target = path.resolve(resolvedRoot, cleanRelativePath);
    if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`Refusing to write outside app tree: ${relativePath}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
    written.push(cleanRelativePath);
  }
  return written.sort();
}

function readLocalTree(root: string): Record<string, string> {
  const resolvedRoot = path.resolve(root);
  const files: Record<string, string> = {};
  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) files[path.relative(resolvedRoot, fullPath).split(path.sep).join('/')] = fs.readFileSync(fullPath, 'utf8');
    }
  }
  walk(resolvedRoot);
  return files;
}

function appTreeKind(filePath: string): 'screen' | 'function' | 'data' | 'manifest' | 'other' {
  if (filePath.startsWith('app/screens/')) return 'screen';
  if (filePath.startsWith('app/functions/')) return 'function';
  if (filePath.startsWith('app/data/')) return 'data';
  if (filePath === 'app/manifest.json' || filePath === 'app/sidebar.json5') return 'manifest';
  return 'other';
}

function diffTrees(remoteFiles: Record<string, string>, localFiles: Record<string, string>) {
  const paths = Array.from(new Set([...Object.keys(remoteFiles), ...Object.keys(localFiles)])).sort();
  return paths.flatMap(filePath => {
    const change = { kind: appTreeKind(filePath), path: filePath };
    if (!(filePath in remoteFiles)) return [{ status: 'added', ...change }];
    if (!(filePath in localFiles)) return [{ status: 'deleted', ...change }];
    if (remoteFiles[filePath] !== localFiles[filePath]) return [{ status: 'modified', ...change }];
    return [];
  });
}

function usage(): never {
  console.error(`PeopleClaw CLI v1

Usage:
  peopleclaw configure --base-url <url> --api-key <pc_m2m_...>
  peopleclaw whoami [--json]
  peopleclaw apps list [--json]
  peopleclaw app inspect <appId> [--json]
  peopleclaw app pull <appId> [--dir <path>] [--json]
  peopleclaw app plan <appId> [--dir <path>] [--json]
  peopleclaw app chat <appId> <message...> [--session-id <id>] [--confirm] [--dry-run] [--json]
  peopleclaw app action <appId> <operation> [--args '{"name":"..."}'] [--confirm] [--dry-run] [--json]

Environment:
  PEOPLECLAW_BASE_URL, PEOPLECLAW_API_KEY, PEOPLECLAW_CONFIG

Safety:
  Mutating chat/action commands default to dry-run. Pass --confirm --dry-run=false to execute.`);
  process.exit(2);
}

async function main() {
  const { flags, positional } = parseFlags(process.argv.slice(2));
  const [cmd, subcmd, ...rest] = positional;
  if (!cmd || cmd === 'help' || flags.help) usage();

  if (cmd === 'configure') {
    const current = loadConfig();
    const next: Config = {
      ...current,
      ...(textFlag(flags.baseUrl) ? { baseUrl: textFlag(flags.baseUrl) } : {}),
      ...(textFlag(flags.apiKey) ? { apiKey: textFlag(flags.apiKey) } : {}),
    };
    if (!next.baseUrl) next.baseUrl = DEFAULT_BASE_URL;
    if (!next.apiKey) throw new Error('--api-key is required unless an API key is already configured');
    saveConfig(next);
    print({ ok: true, configPath: CONFIG_PATH, baseUrl: next.baseUrl, apiKeyPrefix: `${next.apiKey.slice(0, 18)}…` }, flags, `Saved PeopleClaw config to ${CONFIG_PATH}`);
    return;
  }

  if (cmd === 'whoami') {
    const body = await request('/external-agent/whoami', { flags });
    print(body, flags, `Authenticated as ${(body as any).externalAgent?.name ?? 'external agent'}`);
    return;
  }

  if (cmd === 'apps' && subcmd === 'list') {
    const body = await request('/external-agent/apps', { flags });
    const apps = Array.isArray((body as any).apps) ? (body as any).apps : [];
    print(body, flags, apps.map((app: any) => `${app.id}\t${app.name}`).join('\n') || 'No apps');
    return;
  }

  if (cmd === 'app' && subcmd === 'inspect') {
    const appId = rest[0];
    if (!appId) usage();
    const body = await request(`/external-agent/apps/${encodeURIComponent(appId)}`, { flags });
    print(body, flags, `${(body as any).app?.name ?? appId}: ${(body as any).counts?.components ?? 0} components`);
    return;
  }

  if (cmd === 'app' && subcmd === 'pull') {
    const appId = rest[0];
    if (!appId) usage();
    const body = await request(`/external-agent/apps/${encodeURIComponent(appId)}`, { flags });
    const files = fileEntries(body);
    if (!Object.keys(files).length) throw new Error('Inspect response did not include a repo-like app tree.');
    const outputDir = path.resolve(textFlag(flags.dir) ?? appId);
    const written = safeWriteAppTree(outputDir, files);
    print({ ok: true, appId, outputDir, files: written }, flags, `Wrote ${written.length} files to ${outputDir}`);
    return;
  }

  if (cmd === 'app' && subcmd === 'plan') {
    const appId = rest[0];
    if (!appId) usage();
    const body = await request(`/external-agent/apps/${encodeURIComponent(appId)}`, { flags });
    const remoteFiles = fileEntries(body);
    if (!Object.keys(remoteFiles).length) throw new Error('Inspect response did not include a repo-like app tree.');
    const inputDir = path.resolve(textFlag(flags.dir) ?? appId);
    const changes = diffTrees(remoteFiles, readLocalTree(inputDir));
    const fallback = changes.length ? changes.map(change => `${change.status}\t${change.path}`).join('\n') : 'No changes';
    print({ ok: true, appId, inputDir, changes }, flags, fallback);
    return;
  }

  if (cmd === 'app' && subcmd === 'chat') {
    const appId = rest[0];
    const message = rest.slice(1).join(' ').trim();
    if (!appId || !message) usage();
    const dryRunFlag = boolFlag(flags.dryRun);
    const confirmed = Boolean(flags.confirm);
    const body = await request(`/external-agent/apps/${encodeURIComponent(appId)}/chat`, {
      method: 'POST',
      flags,
      body: {
        message,
        sessionId: textFlag(flags.sessionId),
        threadId: textFlag(flags.threadId),
        confirmed,
        dryRun: dryRunFlag ?? !confirmed,
      },
    });
    print(body, flags, (body as any).response ?? JSON.stringify(body));
    return;
  }

  if (cmd === 'app' && subcmd === 'action') {
    const appId = rest[0];
    const operation = rest[1];
    if (!appId || !operation) usage();
    let args: Json = {};
    const rawArgs = textFlag(flags.args);
    if (rawArgs) {
      const parsed = JSON.parse(rawArgs);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('--args must be a JSON object');
      args = parsed as Json;
    }
    const dryRunFlag = boolFlag(flags.dryRun);
    const confirmed = Boolean(flags.confirm);
    const body = await request(`/external-agent/apps/${encodeURIComponent(appId)}/action`, {
      method: 'POST',
      flags,
      body: { operation, args, confirmed, dryRun: dryRunFlag ?? !confirmed },
    });
    print(body, flags, (body as any).action?.summary ?? JSON.stringify(body));
    return;
  }

  usage();
}

main().catch((error) => {
  const body = (error as any).body;
  if (body && typeof body === 'object') {
    console.error(JSON.stringify({ ok: false, error: error.message, status: (error as any).status, body }, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
});
