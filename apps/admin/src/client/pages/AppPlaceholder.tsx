/**
 * PLANET-1408: Placeholder dual-pane (chat + canvas) for Stage 2.
 * Minimal — next ticket will build the real thing.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TenantSwitcher from '../components/TenantSwitcher';
import UserMenu from '../components/UserMenu';
import CreditsBadge from '../components/CreditsBadge';

export default function AppPlaceholder() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => {
        if (!r.ok) { navigate('/signin'); return null; }
        return r.json();
      })
      .then(d => { if (d) setUser(d); })
      .catch(() => navigate('/signin'));
  }, [navigate]);

  if (!user) return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>;

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg">PeopleClaw</span>
          <TenantSwitcher />
        </div>
        <div className="flex items-center gap-3">
          <CreditsBadge />
          <UserMenu />
        </div>
      </header>

      {/* Dual pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat pane */}
        <div className="w-1/2 border-r border-border flex items-center justify-center bg-muted/30">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium mb-1">💬</p>
            <p>聊天功能即将上线</p>
          </div>
        </div>
        {/* Canvas pane */}
        <div className="w-1/2 flex items-center justify-center bg-muted/10">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium mb-1">🎨</p>
            <p>组件画布即将上线</p>
          </div>
        </div>
      </div>
    </div>
  );
}
