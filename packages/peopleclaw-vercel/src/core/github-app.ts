import { createSign } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type GitHubAppConfig = {
  appId: string;
  installationId: string;
  privateKeyPath: string;
  repos: string[];
  permissions: Record<string, string>;
  secretsDir: string;
};

export type GitHubRepo = { owner: string; name: string; fullName: string };

export const DEFAULT_GITHUB_APP_PERMISSIONS: Record<string, string> = {
  contents: 'write',
  metadata: 'read',
  actions: 'write',
  issues: 'write',
  pull_requests: 'write',
  secrets: 'write',
  workflows: 'write',
};

export function parseRepoList(value: string | string[] | undefined): GitHubRepo[] {
  const raw = Array.isArray(value) ? value : (value ?? '').split(',');
  const seen = new Set<string>();
  const repos: GitHubRepo[] = [];
  for (const item of raw.map((entry) => entry.trim()).filter(Boolean)) {
    const match = /^([^/\s]+)\/([^/\s]+)$/.exec(item);
    if (!match) throw new Error(`Invalid GitHub repo "${item}". Expected owner/repo.`);
    const owner = match[1];
    const name = match[2];
    const fullName = `${owner}/${name}`;
    if (seen.has(fullName)) continue;
    seen.add(fullName);
    repos.push({ owner, name, fullName });
  }
  return repos;
}

export function parsePermissions(value: string | undefined): Record<string, string> {
  if (!value) return { ...DEFAULT_GITHUB_APP_PERMISSIONS };
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('GitHub App permissions must be a JSON object.');
  const permissions: Record<string, string> = {};
  for (const [key, permission] of Object.entries(parsed)) {
    if (typeof permission !== 'string') throw new Error(`GitHub App permission ${key} must be a string.`);
    permissions[key] = permission;
  }
  return permissions;
}

export function buildInstallationTokenBody(repos: GitHubRepo[], permissions: Record<string, string>): Record<string, unknown> {
  return {
    repositories: repos.map((repo) => repo.name),
    permissions,
  };
}

export function buildAuthenticatedRemoteUrl(repo: GitHubRepo, token: string): string {
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${repo.fullName}.git`;
}

export function repoLocalPath(rootDir: string, repo: GitHubRepo): string {
  return path.join(rootDir, 'repos', repo.name);
}

export async function createGitHubAppJwt(appId: string, privateKeyPath: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const privateKey = await fs.readFile(privateKeyPath, 'utf8');
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  // GitHub recommends issuing slightly in the past for clock skew and expiring within 10 minutes.
  const payload = base64UrlJson({ iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: appId });
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

export async function requestInstallationToken(config: GitHubAppConfig): Promise<{ token: string; expiresAt?: string; body: Record<string, unknown> }> {
  const repos = parseRepoList(config.repos);
  if (repos.length === 0) throw new Error('At least one GitHub repo must be configured with --repo/--repos or GITHUB_APP_REPOS.');
  const jwt = await createGitHubAppJwt(config.appId, config.privateKeyPath);
  const body = buildInstallationTokenBody(repos, config.permissions);
  const res = await fetch(`https://api.github.com/app/installations/${config.installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${jwt}`,
      'content-type': 'application/json',
      'user-agent': 'peopleclaw-cli',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub installation token request failed (${res.status}): ${text}`);
  const parsed = JSON.parse(text) as { token?: string; expires_at?: string };
  if (!parsed.token) throw new Error('GitHub installation token response did not include a token.');
  return { token: parsed.token, expiresAt: parsed.expires_at, body };
}

export async function writeGitHubTokenFiles(secretsDir: string, token: string, metadata: Record<string, unknown>): Promise<{ tokenPath: string; metadataPath: string }> {
  await fs.mkdir(secretsDir, { recursive: true, mode: 0o700 });
  const tokenPath = path.join(secretsDir, 'github-token.txt');
  const metadataPath = path.join(secretsDir, 'github-app-token.json');
  await fs.writeFile(tokenPath, `${token}\n`, { mode: 0o600 });
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(tokenPath, 0o600).catch(() => undefined);
  await fs.chmod(metadataPath, 0o600).catch(() => undefined);
  return { tokenPath, metadataPath };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
