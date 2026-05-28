/**
 * PeopleClaw per-App shell for non-technical users.
 *
 * The shell intentionally exposes product/app surfaces only. Runtime component,
 * canvas, cron, runner, secret, and flow internals remain API-backed platform
 * details and are not navigation items in the customer UI.
 */
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import AppTopBar from '../AppTopBar';
import { cn } from '../../lib/utils';

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

interface AppInnerShellProps {
  /** Optional title shown in the top bar centre. */
  title?: string;
  children: React.ReactNode;
}

export default function AppInnerShell({ title, children }: AppInnerShellProps) {
  const { id } = useParams<{ id: string }>();
  const base = `/app/${id ?? ''}`;

  const appSection: NavItemDef[] = [
    { to: `${base}/dashboard`, label: 'Overview', icon: LayoutDashboard, testId: 'inner-nav-dashboard' },
    { to: `${base}/build`,     label: 'Build App', icon: Sparkles,        testId: 'inner-nav-build' },
    { to: `${base}/chat`,      label: 'Chat',      icon: MessageSquare,   testId: 'inner-nav-chat' },
  ];

  return (
    <div className="flex flex-col h-screen">
      <AppTopBar title={title} />
      <div className="flex flex-1 min-h-0">
        <AppInnerSidebar
          appSection={appSection}
          appId={id ?? ''}
        />
        <main
          data-testid="app-inner-main"
          className="flex-1 min-w-0 min-h-0 overflow-hidden bg-background"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function AppInnerSidebar({
  appSection,
  appId,
}: {
  appSection: NavItemDef[];
  appId: string;
}) {
  return (
    <aside
      data-testid="app-inner-sidebar"
      className="w-[232px] h-full border-r border-border bg-background flex flex-col shrink-0"
    >
      <div className="p-2 border-b border-border">
        <Link
          to="/apps"
          data-testid="back-to-apps"
          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Apps</span>
        </Link>
      </div>

      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        <NavSection label="App" testId="inner-nav-section-app" items={appSection} />
      </nav>

      <div className="p-3 border-t border-border text-[10px] text-muted-foreground">
        <span data-testid="app-inner-app-id" className="font-mono truncate block">
          app:{appId.slice(0, 10)}
        </span>
      </div>
    </aside>
  );
}

function NavSection({
  label,
  testId,
  items,
}: {
  label: string;
  testId: string;
  items: NavItemDef[];
}) {
  return (
    <div data-testid={testId}>
      <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map(item => (
          <SidebarNavLink key={item.to} item={item} />
        ))}
      </div>
    </div>
  );
}

function SidebarNavLink({ item }: { item: NavItemDef }) {
  return (
    <NavLink
      to={item.to}
      end
      data-testid={item.testId}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-muted text-foreground font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

/** Helper for callers that want to know which inner route is active. */
export function useInnerSectionFromLocation() {
  const loc = useLocation();
  const m = loc.pathname.match(/^\/app\/[^/]+\/(.+)$/);
  return m?.[1] ?? null;
}
