/**
 * PLANET-1431: Unified sidebar — Apps / Published / Security / Settings.
 */
import { Box, Globe, Shield, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import CreditsBadge from './CreditsBadge';

const navItems = [
  { icon: Box, label: 'Apps', path: '/apps', match: (p: string) => p.startsWith('/apps') || p.startsWith('/app') },
  { icon: Globe, label: 'Published', path: '/published', match: (p: string) => p.startsWith('/published') },
  { icon: Shield, label: 'Security', path: '/security', match: (p: string) => p.startsWith('/security') },
  { icon: Settings, label: 'Settings', path: '/settings', match: (p: string) => p.startsWith('/settings') },
];

export default function AppsSidebar() {
  const location = useLocation();

  return (
    <aside data-testid="apps-sidebar" className="w-[200px] h-full border-r border-border bg-background flex flex-col shrink-0">
      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(item => {
          const isActive = item.match(location.pathname);
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom plan info */}
      <div className="p-3 border-t border-border">
        <CreditsBadge />
      </div>
    </aside>
  );
}
