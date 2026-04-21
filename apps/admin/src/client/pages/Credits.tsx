import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { apiJSON, apiFetch } from '../lib/api';
import CreditsBadge from '../components/CreditsBadge';
import { ThemeToggle } from '../components/theme-toggle';

interface Pack {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
}

interface UsageLog {
  id: number;
  action: string;
  creditsUsed: number;
  creditsAdded: number;
  packId: string | null;
  amountPaid: number | null;
  createdAt: string;
}

export default function Credits() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [usage, setUsage] = useState<UsageLog[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    apiJSON<{ packs: Pack[] }>('/api/credits/packs').then((d) => setPacks(d.packs)).catch(() => {});
    apiJSON<{ logs: UsageLog[] }>('/api/credits/usage').then((d) => setUsage(d.logs)).catch(() => {});
  }, []);

  async function buy(packId: string) {
    setBusy(packId);
    try {
      const res = await apiFetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      if (!res.ok) {
        alert('Checkout failed: ' + (await res.text()));
        return;
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buy AI credits to power workflow steps.{' '}
            <Link to="/dashboard" className="underline">
              ← Dashboard
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <CreditsBadge />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packs.map((p) => (
          <Card key={p.id} className={p.popular ? 'border-primary' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>{p.name}</CardTitle>
                {p.popular && <Badge>Popular</Badge>}
              </div>
              <CardDescription>{p.credits} credits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold" data-testid={`credit-pack-${p.id}-price`}>
                A${(p.price / 100).toFixed(2)}
              </div>
              <Button
                className="w-full"
                onClick={() => buy(p.id)}
                disabled={busy === p.id}
                data-testid={`credit-pack-${p.id}-buy`}
              >
                {busy === p.id ? 'Loading…' : 'Buy'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent usage</h2>
        <div className="space-y-2">
          {usage.length === 0 && (
            <p className="text-sm text-muted-foreground">No usage yet.</p>
          )}
          {usage.map((u) => (
            <Card key={u.id} data-testid="credits-usage-row">
              <CardContent className="py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{u.action}</Badge>
                  <span className="text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="font-mono">
                  {u.creditsAdded > 0 && <span className="text-green-600">+{u.creditsAdded}</span>}
                  {u.creditsUsed > 0 && <span className="text-red-600">-{u.creditsUsed}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
