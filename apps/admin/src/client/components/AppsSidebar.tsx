import { Home, Box, Globe, Shield, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { icon: Home, label: 'Home', path: '/apps' },
  { icon: Box, label: 'Apps', path: '/apps' },
  { icon: Globe, label: 'Published', path: '/published' },
  { icon: Shield, label: 'Security', path: '/security' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function AppsSidebar() {
  const location = useLocation();

  return (
    <aside data-testid="apps-sidebar" className="w-[200px] h-full border-r border-border bg-background flex flex-col shrink-0">
      {/* Workspace switcher */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted">
          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">P</div>
          <span className="text-sm font-medium truncate">PeopleClaw</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.label === 'Apps' && location.pathname === '/apps') ||
            (item.label === 'Home' && location.pathname === '/apps');
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
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Free Plan</p>
          <p>3 apps · Unlimited previews</p>
        </div>
      </div>
    </aside>
  );
}
