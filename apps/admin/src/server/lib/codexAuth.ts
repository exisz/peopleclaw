import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { refreshOpenAICodexToken, type OAuthCredentials } from '@mariozechner/pi-ai';

interface CodexProfile extends OAuthCredentials {
  type: 'oauth';
  provider: 'openai-codex';
  email?: string;
  accountId?: string;
  chatgptPlanType?: string;
  displayName?: string;
}

interface AuthProfileStore {
  version?: number;
  profiles?: Record<string, unknown>;
}

const DEFAULT_AUTH_PROFILES_PATH = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json');
const DEFAULT_PROFILE_ID = 'openai-codex:gotexis@gmail.com';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function authProfilesPath(): string {
  return process.env.PEOPLECLAW_CODEX_AUTH_PROFILES_PATH
    ?? process.env.OPENCLAW_AUTH_PROFILES_PATH
    ?? DEFAULT_AUTH_PROFILES_PATH;
}

function profileId(): string {
  return process.env.PEOPLECLAW_CODEX_AUTH_PROFILE
    ?? process.env.OPENAI_CODEX_PROFILE_ID
    ?? DEFAULT_PROFILE_ID;
}

function isCodexProfile(value: unknown): value is CodexProfile {
  const v = value as Partial<CodexProfile> | undefined;
  return Boolean(v && v.type === 'oauth' && v.provider === 'openai-codex' && typeof v.access === 'string' && typeof v.refresh === 'string');
}

function loadStore(filePath: string): AuthProfileStore {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as AuthProfileStore;
}

function saveStore(filePath: string, store: AuthProfileStore): void {
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}

function envProfile(): CodexProfile | null {
  const access = process.env.PEOPLECLAW_CODEX_ACCESS_TOKEN;
  const refresh = process.env.PEOPLECLAW_CODEX_REFRESH_TOKEN;
  if (!access || !refresh) return null;
  return {
    type: 'oauth',
    provider: 'openai-codex',
    access,
    refresh,
    expires: Number(process.env.PEOPLECLAW_CODEX_EXPIRES || 0) || Date.now() + 30 * 60 * 1000,
    email: process.env.PEOPLECLAW_CODEX_EMAIL,
    accountId: process.env.PEOPLECLAW_CODEX_ACCOUNT_ID,
    chatgptPlanType: process.env.PEOPLECLAW_CODEX_PLAN_TYPE,
  };
}

export async function getCodexAccessToken(): Promise<{ accessToken: string; profileId: string; email?: string; expires?: number }> {
  const env = envProfile();
  if (env) {
    const refreshed = await refreshIfNeeded(env);
    return { accessToken: refreshed.access, profileId: 'env', email: refreshed.email, expires: refreshed.expires };
  }

  const filePath = authProfilesPath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Codex auth profile store not found. Set PEOPLECLAW_CODEX_AUTH_PROFILES_PATH or PEOPLECLAW_CODEX_ACCESS_TOKEN/REFRESH_TOKEN. Looked at: ${filePath}`);
  }
  const store = loadStore(filePath);
  const id = profileId();
  const profile = store.profiles?.[id];
  if (!isCodexProfile(profile)) {
    throw new Error(`OpenAI Codex OAuth profile '${id}' not found in auth profile store`);
  }
  const refreshed = await refreshIfNeeded(profile);
  if (refreshed !== profile) {
    store.profiles = { ...(store.profiles ?? {}), [id]: refreshed };
    saveStore(filePath, store);
  }
  return { accessToken: refreshed.access, profileId: id, email: refreshed.email, expires: refreshed.expires };
}

async function refreshIfNeeded(profile: CodexProfile): Promise<CodexProfile> {
  if (Number.isFinite(profile.expires) && profile.expires > Date.now() + REFRESH_MARGIN_MS) return profile;
  const refreshed = await refreshOpenAICodexToken(profile.refresh);
  return {
    ...profile,
    ...refreshed,
    type: 'oauth',
    provider: 'openai-codex',
  };
}
