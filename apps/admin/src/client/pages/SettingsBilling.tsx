import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiJSON } from '../lib/api';

interface UsageLog {
  id: number; action: string; creditsUsed: number; creditsAdded: number;
  packId: string | null; amountPaid: number | null; createdAt: string;
}

export default function SettingsBilling() {
  const [data, setData] = useState<{ tenant: { credits: number; plan: string }; logs: UsageLog[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJSON<{ tenant: { credits: number; plan: string }; logs: UsageLog[] }>('/api/credits/usage')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading…</p>;
  }
  if (!data) return <p className="text-sm text-destructive">Failed to load.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase">Plan</p>
            <p className="text-2xl font-semibold capitalize" data-testid="billing-plan">{data.tenant.plan}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase">Credits</p>
            <p className="text-2xl font-semibold flex items-center gap-2" data-testid="billing-credits">
              <Coins className="h-5 w-5" /> {data.tenant.credits}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center">
            <Button asChild className="w-full">
              <Link to="/credits" data-testid="billing-buy">Buy more credits</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-base font-medium mb-2">Recent usage</h3>
        {data.logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Added</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((l) => (
                <TableRow key={l.id} data-testid="billing-usage-row">
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                  <TableCell className="text-right">{l.creditsUsed || '—'}</TableCell>
                  <TableCell className="text-right">{l.creditsAdded || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.packId ?? ''}{l.amountPaid ? ` $${(l.amountPaid / 100).toFixed(2)}` : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
