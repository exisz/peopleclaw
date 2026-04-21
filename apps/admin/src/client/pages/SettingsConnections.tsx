import { useEffect, useState } from 'react';
import { Trash2, Loader2, RefreshCw, CheckCircle2, XCircle, Plug } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { apiJSON, getCurrentTenantSlug } from '../lib/api';

interface Connection {
  id: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

function normalizeShopDomain(s: string): string {
  const v = s.trim();
  if (!v) return v;
  if (!v.includes('.')) return `${v}.myshopify.com`;
  return v;
}

export default function SettingsConnections() {
  // --- existing connections list ---
  const [list, setList] = useState<Connection[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // --- shopify inline form ---
  const [shopDomain, setShopDomain] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMsg, setTestMsg] = useState('');   // shop name on success, error on fail
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // pre-fill form if a shopify connection already exists
  const shopifyConn = list.find((c) => c.type === 'shopify');

  async function reload() {
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    setListLoading(true);
    try {
      const d = await apiJSON<{ connections: Connection[] }>(`/api/tenants/${slug}/connections`);
      setList(d.connections);
    } catch {/* silent */}
    finally { setListLoading(false); }
  }
  useEffect(() => { void reload(); }, []);

  // reset test badge whenever inputs change
  function handleShopChange(v: string) { setShopDomain(v); setTestState('idle'); setTestMsg(''); setSaveErr(null); }
  function handleTokenChange(v: string) { setAdminToken(v); setTestState('idle'); setTestMsg(''); setSaveErr(null); }

  async function testConnection() {
    const slug = getCurrentTenantSlug();
    if (!slug || !shopDomain || !adminToken) return;
    setTestState('testing'); setTestMsg(''); setSaveErr(null);
    try {
      const r = await apiJSON<{ ok: true; shop: { name: string; domain: string } }>(
        `/api/tenants/${slug}/connections/shopify/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop_domain: normalizeShopDomain(shopDomain), admin_token: adminToken }),
        },
      );
      setTestState('ok');
      setTestMsg(r.shop.name);
    } catch (e) {
      setTestState('fail');
      setTestMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveConnection() {
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    setSaving(true); setSaveErr(null);
    try {
      await apiJSON(`/api/tenants/${slug}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'shopify',
          config: { shop_domain: normalizeShopDomain(shopDomain), admin_token: adminToken },
        }),
      });
      setAdminToken(''); // clear sensitive input
      await reload();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  async function refreshOne(id: string) {
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    setRefreshingId(id);
    try {
      await apiJSON(`/api/tenants/${slug}/connections/${id}/refresh`, { method: 'POST' });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally { setRefreshingId(null); }
  }

  async function del(id: string) {
    if (!confirm('删除此连接？')) return;
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    try {
      await apiJSON(`/api/tenants/${slug}/connections/${id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const canTest = shopDomain.trim().length > 0 && adminToken.trim().length > 0;
  const canSave = testState === 'ok' && !saving;

  return (
    <div className="space-y-6">

      {/* ── Shopify 连接区域 ── */}
      <Card data-testid="shopify-connection-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#96bf48]/10">
              {/* Shopify-green icon placeholder */}
              <Plug className="h-4 w-4 text-[#96bf48]" />
            </div>
            <div>
              <CardTitle className="text-base">Shopify 连接</CardTitle>
              <CardDescription className="text-xs">
                连接后工作流可直接读写 Shopify 商品、订单数据
              </CardDescription>
            </div>
            {/* Current connected status badge */}
            {shopifyConn?.enabled && (
              <Badge className="ml-auto bg-green-600 text-white hover:bg-green-700 gap-1">
                <CheckCircle2 className="h-3 w-3" /> 已连接
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* If already connected, show summary row */}
          {shopifyConn && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <span className="font-mono flex-1 truncate text-xs">
                {typeof shopifyConn.config.shop_domain === 'string'
                  ? shopifyConn.config.shop_domain
                  : 'Shopify'}
              </span>
              <Button
                variant="ghost" size="sm"
                onClick={() => refreshOne(shopifyConn.id)}
                disabled={refreshingId === shopifyConn.id}
                title="刷新 Token"
              >
                {refreshingId === shopifyConn.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => del(shopifyConn.id)}
                title="删除连接"
                data-testid="shopify-delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}

          {/* Form — always visible so user can re-connect / update */}
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="shopify-domain">
                店铺域名
              </Label>
              <Input
                id="shopify-domain"
                data-testid="shopify-shop-input"
                placeholder="yourstore.myshopify.com"
                value={shopDomain}
                onChange={(e) => handleShopChange(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                填写格式：<code className="font-mono">yourstore.myshopify.com</code>
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="shopify-token">
                Admin API Token
              </Label>
              <Input
                id="shopify-token"
                data-testid="shopify-admin-token-input"
                type="password"
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                value={adminToken}
                onChange={(e) => handleTokenChange(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">
                从 Shopify Admin → <strong>Apps</strong> → <strong>Develop apps</strong> → API credentials 获取
              </p>
            </div>

            {/* Test result feedback */}
            {testState === 'ok' && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>连接成功 ✅ — <strong>{testMsg}</strong></span>
              </div>
            )}
            {testState === 'fail' && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="break-all">{testMsg}</span>
              </div>
            )}
            {saveErr && (
              <p className="text-sm text-destructive break-all">{saveErr}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={!canTest || testState === 'testing'}
                data-testid="shopify-test"
              >
                {testState === 'testing'
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> 测试中…</>
                  : '测试连接'}
              </Button>
              <Button
                onClick={saveConnection}
                disabled={!canSave}
                data-testid="shopify-save"
                title={testState !== 'ok' ? '请先测试连接' : undefined}
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> 保存中…</>
                  : shopifyConn ? '更新连接' : '保存连接'}
              </Button>
            </div>
            {testState !== 'ok' && canTest && (
              <p className="text-[11px] text-muted-foreground">请先点"测试连接"验证后再保存</p>
            )}
          </div>

          {listLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> 加载中…
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Other connections (non-shopify) ── */}
      {list.filter((c) => c.type !== 'shopify').length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">其他连接</h3>
          {list.filter((c) => c.type !== 'shopify').map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              data-testid={`connection-row-${c.type}`}
            >
              <span className="capitalize font-medium w-24">{c.type}</span>
              <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
                {JSON.stringify(c.config)}
              </span>
              <Badge variant={c.enabled ? 'secondary' : 'outline'}>
                {c.enabled ? '已启用' : '已禁用'}
              </Badge>
              <Button
                variant="ghost" size="sm"
                onClick={() => del(c.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
