import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { Badge } from './ui/badge';
import { apiJSON, getCurrentTenantSlug } from '../lib/api';

export default function CreditsBadge() {
  const [credits, setCredits] = useState<number | null>(null);
  useEffect(() => {
    apiJSON<{ tenants: Array<{ slug: string; credits: number }> }>('/api/me')
      .then((d) => {
        const slug = getCurrentTenantSlug();
        const t = d.tenants.find((x) => x.slug === slug) ?? d.tenants[0];
        setCredits(t?.credits ?? null);
      })
      .catch(() => setCredits(null));
  }, []);
  return (
    <Link to="/credits" data-testid="credits-current" className="inline-flex">
      <Badge variant="secondary" className="gap-1">
        <Coins className="h-3 w-3" />
        Credits: {credits ?? '…'}
      </Badge>
    </Link>
  );
}
