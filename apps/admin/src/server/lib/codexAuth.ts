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
const REQUIRED_PROD_ENV = 'PEOPLECLAW_CODEX_ACCESS_TOKEN and PEOPLECLAW_CODEX_REFRESH_TOKEN';

export class CodexAuthUnavailableError extends Error {
  readonly userMessage: string;
  readonly causeMessage?: string;

  constructor(userMessage: string, cause?: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : (cause ? String(cause) : undefined);
    super(causeMessage ? `${userMessage} (${causeMessage})` : userMessage);
    this.name = 'CodexAuthUnavailableError';
    this.userMessage = userMessage;
    this.causeMessage = causeMessage;
  }
}

export function toCodexUserError(error: unknown): string {
  if (error instanceof CodexAuthUnavailableError) return error.userMessage;
  const message = error instanceof Error ? error.message : String(error);
  if (/Failed to refresh OpenAI Codex token/i.test(message) || /refresh.*Codex/i.test(message)) {
    return 'PeopleClaw Chat is temporarily unavailable because the server-side Codex login needs to be reconnected. App editing is safe; please reconnect the Codex OAuth profile or configure fresh PEOPLECLAW_CODEX_* tokens.';
  }
  return message;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

function explicitAuthProfilesPath(): string | undefined {
  return process.env.PEOPLECLAW_CODEX_AUTH_PROFILES_PATH
    ?? process.env.OPENCLAW_AUTH_PROFILES_PATH;
}

function authProfilesPath(): string {
  return explicitAuthProfilesPath() ?? DEFAULT_AUTH_PROFILES_PATH;
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

export function getCodexConnectionStatus(): { configured: boolean; source: 'env' | 'auth-profile' | 'missing'; requiredEnv: string[]; detail: string } {
  if (envProfile()) {
    return {
      configured: true,
      source: 'env',
      requiredEnv: ['PEOPLECLAW_CODEX_ACCESS_TOKEN', 'PEOPLECLAW_CODEX_REFRESH_TOKEN'],
      detail: 'Server-side Codex OAuth tokens are configured from environment variables.',
    };
  }

  const explicitPath = explicitAuthProfilesPath();
  if (explicitPath && fs.existsSync(explicitPath)) {
    return {
      configured: true,
      source: 'auth-profile',
      requiredEnv: ['PEOPLECLAW_CODEX_ACCESS_TOKEN', 'PEOPLECLAW_CODEX_REFRESH_TOKEN'],
      detail: 'Server-side Codex OAuth profile store is configured explicitly.',
    };
  }

  return {
    configured: false,
    source: 'missing',
    requiredEnv: ['PEOPLECLAW_CODEX_ACCESS_TOKEN', 'PEOPLECLAW_CODEX_REFRESH_TOKEN'],
    detail: isProductionRuntime()
      ? `Production Codex connection is not configured. Set ${REQUIRED_PROD_ENV} in Vercel production environment variables.`
      : `Codex connection is not configured. Set ${REQUIRED_PROD_ENV}, or set PEOPLECLAW_CODEX_AUTH_PROFILES_PATH for local development.`,
  };
}

export async function getCodexAccessToken(): Promise<{ accessToken: string; profileId: string; email?: string; expires?: number }> {
  const env = envProfile();
  if (env) {
    const refreshed = await refreshIfNeeded(env);
    return { accessToken: refreshed.access, profileId: 'env', email: refreshed.email, expires: refreshed.expires };
  }

  const explicitPath = explicitAuthProfilesPath();
  if (isProductionRuntime() && !explicitPath) {
    throw new Error(`Production Codex connection is not configured. Set ${REQUIRED_PROD_ENV} in Vercel production environment variables. Local auth profile fallback is disabled in production.`);
  }

  const filePath = authProfilesPath();
  if (!fs.existsSync(filePath)) {
    if (explicitPath) {
      throw new Error(`Configured Codex auth profile store was not found at PEOPLECLAW_CODEX_AUTH_PROFILES_PATH. Set ${REQUIRED_PROD_ENV} for production, or fix the explicit profile path for local development.`);
    }
    throw new Error(`Codex connection is not configured. Set ${REQUIRED_PROD_ENV}, or set PEOPLECLAW_CODEX_AUTH_PROFILES_PATH for local development.`);
  }
  const store = loadStore(filePath);
  const id = profileId();
  const profile = store.profiles?.[id];
  if (!isCodexProfile(profile)) {
    throw new Error(`OpenAI Codex OAuth profile '${id}' not found in configured auth profile store`);
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
  let refreshed: OAuthCredentials;
  try {
    refreshed = await refreshOpenAICodexToken(profile.refresh);
  } catch (e) {
    throw new CodexAuthUnavailableError(
      'PeopleClaw Chat is temporarily unavailable because the server-side Codex login needs to be reconnected. App editing is safe; please reconnect the Codex OAuth profile or configure fresh PEOPLECLAW_CODEX_* tokens.',
      e,
    );
  }
  return {
    ...profile,
    ...refreshed,
    type: 'oauth',
    provider: 'openai-codex',
  };
}
