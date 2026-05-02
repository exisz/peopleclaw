/**
 * App Secrets panel (PLANET-1458).
 * Per-App encrypted secret management. Lists keys, add new, delete.
 */
import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';

interface Props {
  appId: string;
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function AppSecretsPanel({ appId }: Props) {
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const d = await apiClient.get<{ keys: string[] }>(`/api/apps/${appId}/secrets`);
      setKeys(d.keys ?? []);
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

  async function addSecret(e: React.FormEvent) {
    e.preventDefault();
    if (!KEY_PATTERN.test(newKey)) {
      setErr('key 须为字母/数字/下划线, 字母或下划线开头, 1-64 字符');
      return;
    }
    if (!newValue) {
      setErr('value 不能为空');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiClient.put(`/api/apps/${appId}/secrets`, { key: newKey, value: newValue });
      setNewKey('');
      setNewValue('');
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSecret(key: string) {
    if (!confirm(`删除 secret "${key}"?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await apiClient.delete(`/api/apps/${appId}/secrets/${encodeURIComponent(key)}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'failed to delete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto" data-testid="app-secrets-panel">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">🔐 App Secrets</h2>
        <p className="text-xs text-muted-foreground mt-1">
          这些 secret 加密存储, 仅在该 App 的组件运行时通过 <code className="bg-muted px-1 rounded">ctx.secrets.KEY_NAME</code> 注入沙箱.
          Value 永远不会从此页面读出.
        </p>
      </div>

      {err && (
        <div className="alert alert-error mb-3 text-sm" data-testid="app-secrets-error">{err}</div>
      )}

      <form onSubmit={addSecret} className="border border-border rounded-lg p-4 mb-4 bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            data-testid="app-secrets-new-key"
            className="input input-bordered input-sm"
            placeholder="KEY_NAME"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
          <input
            data-testid="app-secrets-new-value"
            type="password"
            className="input input-bordered input-sm"
            placeholder="value (will be encrypted)"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            disabled={busy}
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          data-testid="app-secrets-add-btn"
          className="btn btn-primary btn-sm mt-2"
          disabled={busy || !newKey || !newValue}
        >添加 / 覆盖</button>
      </form>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm" data-testid="app-secrets-list">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2">Key</th>
              <th className="text-right px-3 py-2 w-24">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">加载中...</td></tr>
            )}
            {!loading && keys.length === 0 && (
              <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">还没有 secret</td></tr>
            )}
            {!loading && keys.map(k => (
              <tr key={k} className="border-t border-border" data-testid={`app-secret-row-${k}`}>
                <td className="px-3 py-2 font-mono text-xs">{k}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    data-testid={`app-secret-del-${k}`}
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => deleteSecret(k)}
                    disabled={busy}
                  >删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
