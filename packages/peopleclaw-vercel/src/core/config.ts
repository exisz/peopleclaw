import * as path from 'node:path';
import type { BrokerConfig } from './types.js';

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export function loadBrokerConfig(overrides: Partial<BrokerConfig> = {}): BrokerConfig {
  const dataDir = env('PCV_DATA_DIR', path.join(process.cwd(), '.peopleclaw-vercel'));
  const config: BrokerConfig = {
    storePath: env('PCV_TOKEN_STORE', path.join(dataDir, 'tokens.json')),
    adminSecret: env('PCV_ADMIN_SECRET'),
    vercelToken: env('VERCEL_TOKEN'),
    vercelTeamId: env('VERCEL_TEAM_ID') || null,
    port: Number(env('PORT', env('PCV_PORT', '8787'))),
    host: env('HOST', env('PCV_HOST', '127.0.0.1')),
    publicUrl: env('PCV_PUBLIC_URL') || null,
    auditLogPath: env('PCV_AUDIT_LOG', path.join(dataDir, 'audit.jsonl')),
    ...overrides,
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid PORT/PCV_PORT: ${config.port}`);
  }
  return config;
}

export function assertServerSecrets(config: BrokerConfig): void {
  if (!config.adminSecret || config.adminSecret.length < 16) {
    throw new Error('PCV_ADMIN_SECRET is required and should be at least 16 characters');
  }
  if (!config.vercelToken) {
    throw new Error('VERCEL_TOKEN is required on the broker server and is never exposed to clients');
  }
}
