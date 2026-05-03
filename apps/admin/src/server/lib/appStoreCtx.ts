/**
 * ctx.appStore — generic per-App in-memory key/value store (PLANET-1542).
 *
 * Core primitive, NOT a business-specific integration (§1.4 compliant):
 *   - Generic table+record API; no domain knowledge baked in.
 *   - Same shape any App can use (CRM, todos, blog, polls, ...).
 *   - In-memory only (process-scoped). Sufficient for demo / template scenarios
 *     where persistence across deploys is not required. A future ticket can
 *     swap the backing store for SQLite/Turso behind the same API without
 *     touching component code.
 *
 * API exposed to components via ctx.appStore:
 *   - list(table: string): any[]
 *   - insert(table: string, record: object): { id, createdAt, ...record }
 *   - getById(table: string, id: string): any | null
 *   - listWhere(table: string, predicate: (r) => boolean): any[]
 */

type Record = { id: string; createdAt: number; [k: string]: any };
type AppTables = Map<string, Record[]>; // table name → records
const STORE: Map<string, AppTables> = new Map(); // appId → tables

function getApp(appId: string): AppTables {
  let t = STORE.get(appId);
  if (!t) { t = new Map(); STORE.set(appId, t); }
  return t;
}

function getTable(appId: string, table: string): Record[] {
  const tables = getApp(appId);
  let rows = tables.get(table);
  if (!rows) { rows = []; tables.set(table, rows); }
  return rows;
}

function genId(): string {
  return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export interface AppStore {
  list(table: string): Record[];
  insert(table: string, record: any): Record;
  getById(table: string, id: string): Record | null;
  listWhere(table: string, predicate: (r: Record) => boolean): Record[];
}

export function buildAppStoreCtx(appId: string): AppStore {
  return {
    list(table: string) {
      return [...getTable(appId, table)];
    },
    insert(table: string, record: any) {
      const row: Record = {
        id: genId(),
        createdAt: Date.now(),
        ...(record ?? {}),
      };
      getTable(appId, table).push(row);
      return row;
    },
    getById(table: string, id: string) {
      return getTable(appId, table).find(r => r.id === id) ?? null;
    },
    listWhere(table: string, predicate: (r: Record) => boolean) {
      return getTable(appId, table).filter(predicate);
    },
  };
}

/** Test-only helper (used by e2e clean-up if needed). */
export function __resetAppStore(appId?: string) {
  if (appId) STORE.delete(appId);
  else STORE.clear();
}
