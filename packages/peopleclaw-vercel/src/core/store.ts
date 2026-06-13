import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { generateToken, parseToken, sha256Hex, timingSafeEqualHex } from './token.js';
import type { CustomerToken } from './types.js';

export type TokenStoreFile = {
  version: 1;
  tokens: CustomerToken[];
};

export type IssueTokenInput = {
  label: string;
  allowedRepos?: string[];
  allowedProjects?: string[];
  allowedTeams?: string[];
  expiresAt?: string | null;
};

export type IssuedToken = {
  token: string;
  record: CustomerToken;
};

export class JsonTokenStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<TokenStoreFile> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as TokenStoreFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.tokens)) {
        throw new Error(`Unsupported token store format at ${this.filePath}`);
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: 1, tokens: [] };
      }
      throw error;
    }
  }

  async write(data: TokenStoreFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(tmp, this.filePath);
    await fs.chmod(this.filePath, 0o600).catch(() => undefined);
  }

  async issue(input: IssueTokenInput): Promise<IssuedToken> {
    const data = await this.read();
    const issued = generateToken();
    const now = new Date().toISOString();
    const record: CustomerToken = {
      id: issued.id,
      label: input.label.trim() || issued.id,
      secretHash: issued.secretHash,
      allowedRepos: normalizeList(input.allowedRepos),
      allowedProjects: normalizeList(input.allowedProjects),
      allowedTeams: normalizeList(input.allowedTeams),
      expiresAt: input.expiresAt ?? null,
      createdAt: now,
      lastUsedAt: null,
      revoked: false,
    };
    data.tokens.push(record);
    await this.write(data);
    return { token: issued.full, record };
  }

  async authenticate(fullToken: string): Promise<CustomerToken | null> {
    const parsed = parseToken(fullToken);
    if (!parsed) return null;
    const data = await this.read();
    const found = data.tokens.find((token) => token.id === parsed.id);
    if (!found || found.revoked) return null;
    if (found.expiresAt && Date.parse(found.expiresAt) <= Date.now()) return null;
    if (!timingSafeEqualHex(found.secretHash, sha256Hex(parsed.secret))) return null;
    found.lastUsedAt = new Date().toISOString();
    await this.write(data);
    return found;
  }

  async listSafe(): Promise<Array<Omit<CustomerToken, 'secretHash'> & { secretHash: 'redacted' }>> {
    const data = await this.read();
    return data.tokens.map(({ secretHash: _secretHash, ...token }) => ({ ...token, secretHash: 'redacted' as const }));
  }

  async revoke(id: string): Promise<boolean> {
    const data = await this.read();
    const found = data.tokens.find((token) => token.id === id);
    if (!found) return false;
    found.revoked = true;
    await this.write(data);
    return true;
  }
}

export function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].sort();
}
