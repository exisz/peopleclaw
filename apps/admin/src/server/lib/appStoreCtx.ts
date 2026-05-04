/**
 * ctx.appStore — generic durable per-App key/value store (PLANET-1542 → PLANET-1577).
 *
 * Core primitive, NOT a business-specific integration (§1.4 compliant):
 *   - Generic table+record API; no domain knowledge baked in.
 *   - Same shape any App can use (CRM, todos, blog, polls, ...).
 *   - Backed by AppStoreRecord Prisma model (durable, scoped by
 *     tenantId + appId + table). Payload is JSON-encoded record body.
 *
 * API exposed to components via ctx.appStore (synchronous, snapshot-based):
 *   - list(table)
 *   - insert(table, record)
 *   - getById(table, id)
 *   - listWhere(table, predicate)
 *
 * Lifecycle (PLANET-1577):
 *   1. `await buildAppStoreCtx({ tenantId, appId })` pre-loads all rows for the
 *      App into an in-memory snapshot. Component code reads the snapshot
 *      synchronously (preserving the existing API shape — no `await` required
 *      on list/insert/etc).
 *   2. `insert()` mutates the snapshot AND queues an async write to the DB.
 *   3. The component invoker MUST `await store.flush()` after the user code
 *      finishes so writes are durable before the HTTP response goes out.
 *
 * Why snapshot+flush instead of async API?
 *   Existing component templates (CRM etc.) call `ctx.appStore.insert(...)`
 *   without `await` and read `.id` synchronously off the returned row. Making
 *   the API async would silently break every such call. Snapshot+flush keeps
 *   the contract intact while giving us cross-request durability.
 */
import { getPrisma } from './prisma.js';

export type AppStoreRecord = {
  id: string;
  createdAt: number; // unix ms (mapped from Prisma DateTime for back-compat)
  [k: string]: any;
};

export interface AppStore {
  list(table: string): AppStoreRecord[];
  insert(table: string, record: any): AppStoreRecord;
  getById(table: string, id: string): AppStoreRecord | null;
  listWhere(table: string, predicate: (r: AppStoreRecord) => boolean): AppStoreRecord[];
  /** Await all queued writes so they hit the DB before the response is sent. */
  flush(): Promise<void>;
}

export interface BuildAppStoreCtxArgs {
  /** Tenant scope. Required for durability + multi-tenant isolation. */
  tenantId: string;
  /** App scope. Required. */
  appId: string;
}

function genId(): string {
  // `r_` prefix preserved for back-compat with existing in-memory rows. The
  // value is the canonical primary key written into the DB; no separate cuid.
  return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function decodePayload(raw: string): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Materialize a Prisma row into the public `AppStoreRecord` shape. */
function rowToRecord(row: { id: string; createdAt: Date; payload: string }): AppStoreRecord {
  return {
    ...decodePayload(row.payload),
    id: row.id,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Date.now(),
  };
}

export async function buildAppStoreCtx(
  arg: BuildAppStoreCtxArgs | string,
  legacyAppId?: string,
): Promise<AppStore> {
  // Back-compat: old call sites used `buildAppStoreCtx(appId)`. Without a
  // tenantId we can't safely write durable rows, so we fall back to a
  // process-local in-memory store (same behaviour as before PLANET-1577) and
  // log a one-time warning. Production call sites pass `{ tenantId, appId }`.
  let tenantId: string | undefined;
  let appId: string;
  if (typeof arg === 'string') {
    appId = arg;
    // Two-arg legacy form (tenantId, appId) is not used today, but support it
    // defensively: if a second arg is supplied, treat the first as tenantId.
    if (legacyAppId) {
      tenantId = arg;
      appId = legacyAppId;
    }
  } else {
    tenantId = arg.tenantId;
    appId = arg.appId;
  }

  if (!tenantId) {
    return buildInMemoryFallback(appId);
  }

  const prisma = getPrisma();
  const tablesSnapshot = new Map<string, AppStoreRecord[]>();
  try {
    const rows = await prisma.appStoreRecord.findMany({
      where: { tenantId, appId },
      orderBy: { createdAt: 'asc' },
    });
    for (const row of rows) {
      const rec = rowToRecord(row as any);
      const tableName = (row as any).table as string;
      let bucket = tablesSnapshot.get(tableName);
      if (!bucket) {
        bucket = [];
        tablesSnapshot.set(tableName, bucket);
      }
      bucket.push(rec);
    }
  } catch (err) {
    console.error('[appStoreCtx] preload failed; serving empty snapshot', err);
  }

  const pending: Promise<unknown>[] = [];

  function getBucket(table: string): AppStoreRecord[] {
    let b = tablesSnapshot.get(table);
    if (!b) { b = []; tablesSnapshot.set(table, b); }
    return b;
  }

  return {
    list(table) {
      return [...getBucket(table)];
    },
    insert(table, record) {
      const id = genId();
      const createdAt = Date.now();
      const body = (record && typeof record === 'object' && !Array.isArray(record))
        ? { ...record }
        : {};
      // Strip reserved keys from caller-supplied body so they can't override
      // our PK / timestamp.
      delete (body as any).id;
      delete (body as any).createdAt;
      const row: AppStoreRecord = { ...body, id, createdAt };
      getBucket(table).push(row);
      // Queue durable write. Errors are logged but don't break the in-memory
      // snapshot — the component already saw the row.
      pending.push(
        prisma.appStoreRecord.create({
          data: {
            id,
            tenantId: tenantId!,
            appId,
            table,
            payload: JSON.stringify(body),
            createdAt: new Date(createdAt),
          },
        }).catch((err) => {
          console.error('[appStoreCtx] insert failed', { appId, table, id }, err);
        }),
      );
      return row;
    },
    getById(table, id) {
      return getBucket(table).find(r => r.id === id) ?? null;
    },
    listWhere(table, predicate) {
      return getBucket(table).filter(predicate);
    },
    async flush() {
      if (pending.length === 0) return;
      const queued = pending.splice(0, pending.length);
      await Promise.all(queued);
    },
  };
}

/**
 * Process-local in-memory fallback for legacy call sites that don't pass a
 * tenantId. Same semantics as the pre-PLANET-1577 implementation. Not durable.
 * No call site in `apps/admin` should hit this in production.
 */
const FALLBACK_STORE: Map<string, Map<string, AppStoreRecord[]>> = new Map();
let warnedFallback = false;

function buildInMemoryFallback(appId: string): AppStore {
  if (!warnedFallback) {
    console.warn(
      '[appStoreCtx] buildAppStoreCtx called without tenantId; using ' +
      'process-local in-memory fallback (NOT durable). appId=' + appId,
    );
    warnedFallback = true;
  }
  let tables = FALLBACK_STORE.get(appId);
  if (!tables) { tables = new Map(); FALLBACK_STORE.set(appId, tables); }
  const t = tables;
  function getBucket(table: string): AppStoreRecord[] {
    let b = t.get(table);
    if (!b) { b = []; t.set(table, b); }
    return b;
  }
  return {
    list(table) { return [...getBucket(table)]; },
    insert(table, record) {
      const row: AppStoreRecord = {
        ...(record && typeof record === 'object' ? record : {}),
        id: genId(),
        createdAt: Date.now(),
      };
      getBucket(table).push(row);
      return row;
    },
    getById(table, id) { return getBucket(table).find(r => r.id === id) ?? null; },
    listWhere(table, predicate) { return getBucket(table).filter(predicate); },
    async flush() { /* no-op */ },
  };
}

/** Test-only helper. Resets in-memory fallback bucket(s). */
export function __resetAppStore(appId?: string) {
  if (appId) FALLBACK_STORE.delete(appId);
  else FALLBACK_STORE.clear();
}
