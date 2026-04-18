import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiJSON, getCurrentTenantSlug } from '../lib/api';

interface Member {
  id: number;
  userId: number;
  role: string;
  email: string | null;
  createdAt: string;
}

export default function SettingsTeam() {
  const [list, setList] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    setLoading(true);
    try {
      const d = await apiJSON<{ members: Member[] }>(`/api/tenants/${slug}/members`);
      setList(d.members);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function invite() {
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    setBusy(true); setErr(null);
    try {
      await apiJSON(`/api/tenants/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'member' }),
      });
      setEmail('');
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm('Remove member?')) return;
    const slug = getCurrentTenantSlug();
    if (!slug) return;
    try {
      await apiJSON(`/api/tenants/${slug}/members/${id}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Team</h2>
        <p className="text-sm text-muted-foreground">Manage workspace members. Invitee must have signed in once before being added (TODO: Logto invite email).</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="member-invite-input"
        />
        <Button onClick={invite} disabled={busy || !email} data-testid="member-invite-submit">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Since</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((m) => (
              <TableRow key={m.id} data-testid={`member-row-${m.userId}`}>
                <TableCell>{m.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>{m.role}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => remove(m.id)}>
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
