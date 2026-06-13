import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { appendAudit, assertServerSecrets, JsonTokenStore, loadBrokerConfig, normalizeList, timingSafeEqualString, VERCEL_API_BASE, type BrokerConfig, type CustomerToken } from '../core/index.js';
import { decideCustomerAccess, filterVercelResponse } from './authz.js';

export type BrokerServer = ReturnType<typeof createServer>;

export function createServer(config: BrokerConfig = loadBrokerConfig()) {
  assertServerSecrets(config);
  const store = new JsonTokenStore(config.storePath);

  return http.createServer(async (req, res) => {
    const requestId = randomUUID();
    try {
      await routeRequest(config, store, req, res, requestId);
    } catch (error) {
      await appendAudit(config.auditLogPath, { actor: 'system', action: 'error', requestId, status: 500, reason: (error as Error).message });
      sendJson(res, 500, { error: 'internal_error', requestId });
    }
  });
}

async function routeRequest(config: BrokerConfig, store: JsonTokenStore, req: IncomingMessage, res: ServerResponse, requestId: string): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'peopleclaw-vercel-broker', time: new Date().toISOString() });
    return;
  }

  if (url.pathname.startsWith('/admin/')) {
    if (!isAdmin(config, req)) {
      await appendAudit(config.auditLogPath, { actor: 'admin?', action: url.pathname, method, path: url.pathname, status: 401, allowed: false, reason: 'bad admin secret', requestId });
      sendJson(res, 401, { error: 'unauthorized', requestId });
      return;
    }
    if (method === 'POST' && url.pathname === '/admin/tokens') {
      const body = await readJson(req);
      const issued = await store.issue({
        label: String(body?.label ?? 'customer'),
        allowedRepos: normalizeList(body?.allowedRepos),
        allowedProjects: normalizeList(body?.allowedProjects),
        allowedTeams: normalizeList(body?.allowedTeams),
        expiresAt: typeof body?.expiresAt === 'string' ? body.expiresAt : null,
      });
      await appendAudit(config.auditLogPath, { actor: 'admin', action: 'issue_token', method, path: url.pathname, status: 201, allowed: true, requestId, details: { id: issued.record.id, label: issued.record.label } });
      sendJson(res, 201, { brokerUrl: config.publicUrl, token: issued.token, record: redactRecord(issued.record) });
      return;
    }
    if (method === 'GET' && url.pathname === '/admin/tokens') {
      sendJson(res, 200, { tokens: await store.listSafe() });
      return;
    }
    if (method === 'POST' && url.pathname.startsWith('/admin/tokens/') && url.pathname.endsWith('/revoke')) {
      const id = url.pathname.split('/')[3];
      const ok = await store.revoke(id);
      await appendAudit(config.auditLogPath, { actor: 'admin', action: 'revoke_token', method, path: url.pathname, status: ok ? 200 : 404, allowed: ok, requestId, details: { id } });
      sendJson(res, ok ? 200 : 404, { ok });
      return;
    }
    sendJson(res, 404, { error: 'not_found', requestId });
    return;
  }

  const customer = await authenticateCustomer(store, req);
  if (!customer) {
    await appendAudit(config.auditLogPath, { actor: 'customer?', action: url.pathname, method, path: url.pathname, status: 401, allowed: false, reason: 'bad customer token', requestId });
    sendJson(res, 401, { error: 'unauthorized', requestId });
    return;
  }

  if (method === 'GET' && url.pathname === '/whoami') {
    sendJson(res, 200, { id: customer.id, label: customer.label, allowedRepos: customer.allowedRepos, allowedProjects: customer.allowedProjects, allowedTeams: customer.allowedTeams, expiresAt: customer.expiresAt });
    return;
  }

  if (method === 'GET' && url.pathname === '/projects') {
    await forwardVercel(config, customer, req, res, requestId, `/v9/projects${url.search}`);
    return;
  }
  if (method === 'GET' && url.pathname === '/deployments') {
    await forwardVercel(config, customer, req, res, requestId, `/v6/deployments${url.search}`);
    return;
  }
  if (url.pathname.startsWith('/api/vercel/')) {
    const upstreamPath = `/${url.pathname.slice('/api/vercel/'.length)}${url.search}`;
    await forwardVercel(config, customer, req, res, requestId, upstreamPath);
    return;
  }

  sendJson(res, 404, { error: 'not_found', requestId });
}

async function forwardVercel(config: BrokerConfig, customer: CustomerToken, req: IncomingMessage, res: ServerResponse, requestId: string, upstreamPath: string): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await readJson(req);
  const decision = decideCustomerAccess(customer, method, upstreamPath, body);
  if (!decision.allowed) {
    await appendAudit(config.auditLogPath, { actor: customer.id, action: 'vercel_proxy', method, path: upstreamPath, status: 403, allowed: false, reason: decision.reason, requestId });
    sendJson(res, 403, { error: 'forbidden', reason: decision.reason, requestId });
    return;
  }

  const upstreamUrl = new URL(upstreamPath, VERCEL_API_BASE);
  if (config.vercelTeamId && !upstreamUrl.searchParams.has('teamId')) upstreamUrl.searchParams.set('teamId', config.vercelTeamId);
  const upstream = await fetch(upstreamUrl, {
    method,
    headers: {
      authorization: `Bearer ${config.vercelToken}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') ?? 'application/json';
  await appendAudit(config.auditLogPath, { actor: customer.id, action: 'vercel_proxy', method, path: upstreamUrl.pathname, status: upstream.status, allowed: true, requestId });

  if (contentType.includes('application/json') && text) {
    try {
      const filtered = filterVercelResponse(customer, upstreamUrl.pathname, JSON.parse(text));
      sendJson(res, upstream.status, filtered);
      return;
    } catch {
      // fall through to raw text
    }
  }
  res.writeHead(upstream.status, { 'content-type': contentType });
  res.end(text);
}

function isAdmin(config: BrokerConfig, req: IncomingMessage): boolean {
  const auth = req.headers.authorization ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const header = req.headers['x-admin-secret'];
  const value = bearer || (Array.isArray(header) ? header[0] : header) || '';
  return timingSafeEqualString(String(value), config.adminSecret);
}

async function authenticateCustomer(store: JsonTokenStore, req: IncomingMessage): Promise<CustomerToken | null> {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return store.authenticate(auth.slice(7));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function redactRecord(record: CustomerToken) {
  const { secretHash: _secretHash, ...safe } = record;
  return safe;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadBrokerConfig({ host: process.env.PCV_HOST ?? process.env.HOST ?? '0.0.0.0' });
  const server = createServer(config);
  server.listen(config.port, config.host, () => {
    console.log(`peopleclaw-vercel broker listening on http://${config.host}:${config.port}`);
  });
}
