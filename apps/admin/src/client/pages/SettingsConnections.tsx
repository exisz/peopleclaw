import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiJSON, getCurrentTenantSlug } from '../lib/api';

interface Connection {
  id: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}

function formatRelative(iso: string | undefined, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!iso) return t('connections.tokenExpiresUnknown');
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return t('connections.tokenExpiresUnknown');
  const diffMs = target - Date.now();
  if (diffMs <= 0) return t('connections.tokenExpired');
  const mins = Math.round(diffMs / 60000);
  let when: string;
  if (mins < 60) when = `in ${mins}m`;
  else if (mins < 60 * 24) when = `in ${Math.round(mins / 60)}h`;
  else when = `in ${Math.round(mins / 60 / 24)}d`;
  return t('connections.tokenExpires', { when });
}

export default function SettingsConnections() {
  const { t } = useTranslation('settings');
  const [list, setList] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    setLoading(true);
    try {
      const d = await apiJSON<{ connections: Connection[] }>(`/api/tenants/${slug}/connections`);
      setList(d.connections);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function saveShopify() {
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    setBusy(true); setErr(null);
    try {
      await apiJSON(`/api/tenants/${slug}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'shopify',
          config: { shop_domain: shop, client_id: clientId, client_secret: clientSecret },
        }),
      });
      setOpen(false);
      setShop(''); setClientId(''); setClientSecret('');
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function refreshOne(id: string) {
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    setRefreshingId(id);
    try {
      await apiJSON(`/api/tenants/${slug}/connections/${id}/refresh`, { method: 'POST' });
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshingId(null);
    }
  }

  async function del(id: string) {
    if (!confirm(t('connections.deleteConfirm'))) return;
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    try {
      await apiJSON(`/api/tenants/${slug}/connections/${id}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">{t('connections.heading')}</h2>
          <p className="text-sm text-muted-foreground">{t('connections.subheading')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="connection-add-shopify">
              <Plus className="h-4 w-4" /> {t('connections.addShopify')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('connections.shopifyDialog.title')}</DialogTitle>
              <DialogDescription>{t('connections.shopifyDialog.description')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t('connections.shopifyDialog.shopDomain')}</Label>
                <Input
                  data-testid="shopify-shop-input"
                  placeholder={t('connections.shopifyDialog.shopDomainPlaceholder')}
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('connections.shopifyDialog.clientId')}</Label>
                <Input
                  data-testid="shopify-client-id-input"
                  placeholder={t('connections.shopifyDialog.clientIdPlaceholder')}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('connections.shopifyDialog.clientSecret')}</Label>
                <Input
                  data-testid="shopify-client-secret-input"
                  type="password"
                  placeholder={t('connections.shopifyDialog.clientSecretPlaceholder')}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
              {err && <p className="text-sm text-destructive break-all">{err}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('connections.shopifyDialog.cancel')}
              </Button>
              <Button
                onClick={saveShopify}
                disabled={busy || !shop || !clientId || !clientSecret}
                data-testid="shopify-save"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('connections.shopifyDialog.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline" /> {t('connections.loading')}
        </p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('connections.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('connections.type')}</TableHead>
              <TableHead>{t('connections.details')}</TableHead>
              <TableHead>{t('connections.status')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => {
              const cfg = c.config || {};
              const shopDomain = typeof cfg.shop_domain === 'string' ? cfg.shop_domain : '';
              const expiresAt = typeof cfg.token_expires_at === 'string' ? cfg.token_expires_at : '';
              return (
                <TableRow key={c.id} data-testid={`connection-row-${c.type}`}>
                  <TableCell className="font-medium capitalize">{c.type}</TableCell>
                  <TableCell className="text-xs">
                    {c.type === 'shopify' ? (
                      <div className="space-y-1">
                        {shopDomain && (
                          <Badge variant="outline" className="font-mono">{shopDomain}</Badge>
                        )}
                        <div className="text-muted-foreground">{formatRelative(expiresAt, t)}</div>
                      </div>
                    ) : (
                      <span className="font-mono">{JSON.stringify(cfg)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.enabled ? 'secondary' : 'outline'}>
                      {c.enabled ? t('connections.enabled') : t('connections.disabled')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {c.type === 'shopify' && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => refreshOne(c.id)}
                        disabled={refreshingId === c.id}
                        data-testid={`connection-refresh-${c.id}`}
                        title={t('connections.refreshNow')}
                      >
                        {refreshingId === c.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => del(c.id)}
                      data-testid={`connection-delete-${c.id}`}
                      title={t('connections.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
