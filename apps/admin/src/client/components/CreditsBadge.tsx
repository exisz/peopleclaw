import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { Badge } from './ui/badge';
import { apiJSON } from '../lib/api';

export default function CreditsBadge() {
  const [credits, setCredits] = useState<number | null>(null);
  useEffect(() => {
    apiJSON<{ user: { credits: number } }>('/api/me')
      .then((d) => setCredits(d.user.credits))
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
