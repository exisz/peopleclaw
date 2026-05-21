import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { requireExternalAgent, type ExternalAgentRequest } from '../middleware/externalAgentAuth.js';
import { createExternalAgentToken, publicExternalAgentKey } from '../lib/externalAgentTokens.js';
import { evaluateExternalAgentOperation, normalizeExternalAgentScopes, EXTERNAL_AGENT_SCOPES, EXTERNAL_AGENT_OPERATION_POLICIES } from '../lib/externalAgentSafety.js';

export const externalAgentsRouter = Router();

externalAgentsRouter.get('/external-agent-keys', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const records = await getPrisma().externalAgentKey.findMany({
    where: { tenantId: r.tenant.id },
    include: { app: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ keys: records.map(publicExternalAgentKey) });
});

externalAgentsRouter.post('/external-agent-keys', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  let scopes;
  try {
    scopes = normalizeExternalAgentScopes(req.body?.scopes);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error), allowedScopes: EXTERNAL_AGENT_SCOPES });
    return;
  }

  const prisma = getPrisma();
  const appId = typeof req.body?.appId === 'string' && req.body.appId.trim() ? req.body.appId.trim() : null;
  if (appId) {
    const app = await prisma.app.findFirst({ where: { id: appId, tenantId: r.tenant.id }, select: { id: true } });
    if (!app) {
      res.status(404).json({ error: 'app not found for current tenant' });
      return;
    }
  }

  const tokenParts = createExternalAgentToken();
  const record = await prisma.externalAgentKey.create({
    data: {
      tenantId: r.tenant.id,
      appId,
      name,
      prefix: tokenParts.prefix,
      tokenHash: tokenParts.tokenHash,
      scopes: JSON.stringify(scopes),
      createdByUserId: r.user.id,
    },
    include: { app: { select: { id: true, name: true } } },
  });
  res.status(201).json({
    key: publicExternalAgentKey(record),
    token: tokenParts.token,
    tokenHint: 'Store this token now. PeopleClaw only stores a hash and cannot reveal it again.',
  });
});

externalAgentsRouter.delete('/external-agent-keys/:id', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const record = await prisma.externalAgentKey.findFirst({ where: { id: req.params.id, tenantId: r.tenant.id } });
  if (!record) {
    res.status(404).json({ error: 'external agent key not found' });
    return;
  }
  const revoked = await prisma.externalAgentKey.update({
    where: { id: record.id },
    data: { revokedAt: record.revokedAt ?? new Date() },
  });
  res.json({ key: publicExternalAgentKey(revoked) });
});

externalAgentsRouter.get('/external-agent/whoami', requireExternalAgent('whoami'), async (req, res) => {
  const r = req as ExternalAgentRequest;
  res.json({ externalAgent: r.externalAgent });
});

externalAgentsRouter.post('/external-agent/safety/check', requireExternalAgent('whoami'), async (req, res) => {
  const r = req as ExternalAgentRequest;
  const operation = typeof req.body?.operation === 'string' ? req.body.operation : '';
  const decision = evaluateExternalAgentOperation({
    operation,
    scopes: r.externalAgent.scopes,
    dryRun: Boolean(req.body?.dryRun),
    confirmed: Boolean(req.body?.confirmed),
  });
  res.status(decision.allowed ? 200 : 403).json({ decision });
});

externalAgentsRouter.get('/external-agent/safety/policy', requireExternalAgent('whoami'), async (_req, res) => {
  res.json({ allowedScopes: EXTERNAL_AGENT_SCOPES, operations: EXTERNAL_AGENT_OPERATION_POLICIES });
});
