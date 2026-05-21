import type { Request, Response, NextFunction } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { extractBearerToken, extractExternalAgentTokenPrefix, verifyExternalAgentTokenRecord, type VerifiedExternalAgent } from '../lib/externalAgentTokens.js';
import { evaluateExternalAgentOperation, type ExternalAgentScope } from '../lib/externalAgentSafety.js';

export interface ExternalAgentRequest extends Request {
  externalAgent: VerifiedExternalAgent;
}

export function requireExternalAgent(operation = 'whoami') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractBearerToken(req.header('authorization'));
      if (!token) {
        res.status(401).json({ error: 'Missing Bearer token' });
        return;
      }
      const prefix = extractExternalAgentTokenPrefix(token);
      if (!prefix) {
        res.status(401).json({ error: 'Invalid external agent token format' });
        return;
      }
      const prisma = getPrisma();
      const record = await prisma.externalAgentKey.findUnique({
        where: { prefix },
        include: { tenant: { select: { id: true, slug: true, name: true } }, app: { select: { id: true, name: true } } },
      });
      if (!record) {
        res.status(401).json({ error: 'Invalid external agent token' });
        return;
      }
      const verified = verifyExternalAgentTokenRecord(token, record);
      const decision = evaluateExternalAgentOperation({ operation, scopes: verified.scopes });
      if (!decision.allowed) {
        res.status(decision.reason === 'missing_scope' ? 403 : 400).json({ error: decision.message, reason: decision.reason });
        return;
      }
      (req as ExternalAgentRequest).externalAgent = verified;
      prisma.externalAgentKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
      next();
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : String(error) });
    }
  };
}

export function requireExternalAgentScope(scopes: ExternalAgentScope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const agent = (req as ExternalAgentRequest).externalAgent;
    if (!agent) {
      res.status(401).json({ error: 'external agent auth required' });
      return;
    }
    const missing = scopes.filter((scope) => !agent.scopes.includes(scope));
    if (missing.length) {
      res.status(403).json({ error: `missing external agent scope(s): ${missing.join(', ')}` });
      return;
    }
    next();
  };
}
