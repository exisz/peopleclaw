import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
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

export default function SettingsConnections() {
  const [list, setList] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
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
        body: JSON.stringify({ type: 'shopify', config: { shop_domain: shop, admin_token: token } }),
      });
      setOpen(false);
      setShop(''); setToken('');
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm('Delete this connection?')) return;
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
          <h2 className="text-lg font-medium">Connections</h2>
          <p className="text-sm text-muted-foreground">Per-workspace integrations used by workflow steps.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="connection-add-shopify"><Plus className="h-4 w-4" /> Add Shopify</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Shopify connection</DialogTitle>
              <DialogDescription>
                Enter your Shopify shop domain and Admin API access token. Used by the
                <code> shopify_upload </code> workflow step.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Shop domain</Label>
                <Input
                  data-testid="shopify-shop-input"
                  placeholder="claw-eb6xipji.myshopify.com"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                />
              </div>
              <div>
                <Label>Admin access token</Label>
                <Input
                  data-testid="shopify-token-input"
                  type="password"
                  placeholder="shpat_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={saveShopify} disabled={busy || !shop || !token} data-testid="shopify-save">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No connections yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Config</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id} data-testid={`connection-row-${c.type}`}>
                <TableCell className="font-medium capitalize">{c.type}</TableCell>
                <TableCell className="font-mono text-xs">{JSON.stringify(c.config)}</TableCell>
                <TableCell>
                  <Badge variant={c.enabled ? 'secondary' : 'outline'}>
                    {c.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => del(c.id)}
                    data-testid={`connection-delete-${c.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
