/**
 * Scheduled Tasks panel (PLANET-1460).
 * App-scoped cron-driven invocations of components.
 */
import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';

interface Component {
  id: string;
  name: string;
  type: string;
}

interface Run {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  output: string | null;
  error: string | null;
}

interface Task {
  id: string;
  appId: string;
  componentId: string;
  cron: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  component: Component;
  runs: Run[];
}

interface Props {
  appId: string;
  components: Component[];
}

const CRON_PATTERN = /^\s*(\S+\s+){4}\S+\s*$/;

export function AppScheduledTasksPanel({ appId, components }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newComponentId, setNewComponentId] = useState('');
  const [newCron, setNewCron] = useState('*/5 * * * *');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const d = await apiClient.get<{ tasks: Task[] }>(`/api/apps/${appId}/scheduled-tasks`);
      setTasks(d.tasks ?? []);
    } catch (e: any) {
      setErr(e?.message ?? 'failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newComponentId) { setErr('请选择组件'); return; }
    if (!CRON_PATTERN.test(newCron)) { setErr('cron 须为标准 5 字段表达式 (e.g. * * * * *)'); return; }
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post(`/api/apps/${appId}/scheduled-tasks`, {
        componentId: newComponentId,
        cron: newCron.trim(),
      });
      setNewComponentId('');
      setNewCron('*/5 * * * *');
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'failed to create');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(t: Task) {
    setBusy(true);
    setErr(null);
    try {
      await apiClient.patch(`/api/scheduled-tasks/${t.id}`, { enabled: !t.enabled });
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'failed');
    } finally { setBusy(false); }
  }

  async function deleteTask(t: Task) {
    if (!confirm(`删除定时任务 (${t.component.name} @ ${t.cron})?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await apiClient.delete(`/api/scheduled-tasks/${t.id}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto" data-testid="app-scheduled-tasks-panel">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">⏰ 定时任务</h2>
        <p className="text-xs text-muted-foreground mt-1">
          按 cron 表达式定时调度 BACKEND 组件. 实际触发由 Vercel Cron 每 5 分钟扫描一次,
          所以最小有效粒度是 5 分钟.
        </p>
      </div>

      {err && (
        <div className="alert alert-error mb-3 text-sm" data-testid="sched-error">{err}</div>
      )}

      <form onSubmit={addTask} className="border border-border rounded-lg p-4 mb-4 bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            data-testid="sched-new-component"
            className="select select-bordered select-sm"
            value={newComponentId}
            onChange={e => setNewComponentId(e.target.value)}
            disabled={busy}
          >
            <option value="">— 选择组件 —</option>
            {components.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
          <input
            data-testid="sched-new-cron"
            className="input input-bordered input-sm font-mono"
            placeholder="*/5 * * * *"
            value={newCron}
            onChange={e => setNewCron(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          data-testid="sched-add-btn"
          className="btn btn-primary btn-sm mt-2"
          disabled={busy || !newComponentId}
        >添加定时任务</button>
      </form>

      <div className="space-y-2" data-testid="sched-list">
        {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
        {!loading && tasks.length === 0 && (
          <div className="text-sm text-muted-foreground">还没有定时任务</div>
        )}
        {!loading && tasks.map(t => (
          <div key={t.id} className="border border-border rounded-lg p-3" data-testid={`sched-row-${t.id}`}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{t.component?.name ?? '(deleted)'}</div>
                <div className="text-xs text-muted-foreground font-mono">{t.cron}</div>
                {t.lastRunAt && (
                  <div className="text-xs mt-1">
                    上次:{new Date(t.lastRunAt).toLocaleString()} —{' '}
                    <span className={t.lastStatus === 'ok' ? 'text-success' : 'text-error'}>
                      {t.lastStatus}
                    </span>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={t.enabled}
                  onChange={() => toggleEnabled(t)}
                  disabled={busy}
                  data-testid={`sched-toggle-${t.id}`}
                />
                {t.enabled ? '启用' : '停用'}
              </label>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setExpanded(s => ({ ...s, [t.id]: !s[t.id] }))}
                data-testid={`sched-runs-toggle-${t.id}`}
              >
                {expanded[t.id] ? '收起' : `历史 (${t.runs?.length ?? 0})`}
              </button>
              <button
                className="btn btn-ghost btn-xs text-error"
                onClick={() => deleteTask(t)}
                disabled={busy}
                data-testid={`sched-del-${t.id}`}
              >删除</button>
            </div>
            {expanded[t.id] && (
              <div className="mt-3 border-t border-border pt-2">
                {(!t.runs || t.runs.length === 0) ? (
                  <div className="text-xs text-muted-foreground">无历史</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left">起始</th>
                        <th className="text-left">状态</th>
                        <th className="text-left">详情</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.runs.map(r => (
                        <tr key={r.id} className="border-t border-border/50">
                          <td className="py-1 pr-2">{new Date(r.startedAt).toLocaleString()}</td>
                          <td className={`py-1 pr-2 ${r.status === 'ok' ? 'text-success' : 'text-error'}`}>{r.status}</td>
                          <td className="py-1 font-mono truncate max-w-md">
                            {r.error ?? r.output ?? ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
