import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type AuditEvent = {
  at?: string;
  actor: string;
  action: string;
  method?: string;
  path?: string;
  status?: number;
  allowed?: boolean;
  reason?: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export async function appendAudit(filePath: string, event: AuditEvent): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), ...event });
  await fs.appendFile(filePath, `${line}\n`, { mode: 0o600 });
}
