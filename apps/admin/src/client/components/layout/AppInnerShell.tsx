/**
 * PLANET-1407: Living SaaS shell for inside-an-App navigation.
 *
 * Inside a single App, the user sees:
 *   - Top bar (re-uses AppTopBar with "← Apps" back link)
 *   - App-level sidebar with two sections:
 *       App   — Dashboard / Canvas / Chat (+ business pages later)
 *       System — Module Flow / Cron / Secrets / Runners / Logs
 *   - Content area where Chat is a *page*, not an always-on middle pane.
 *
 * This is presentation/navigation only. Pages reuse existing data wiring
 * (canvas, secrets, scheduled tasks) where available; remaining pages are
 * intentional stubs until later roadmap tickets wire them up.
 *
 * The legacy `/app/:id` dual-pane (Chat + Canvas) route is preserved so all
 * existing E2E behaviour keeps working. The new shell lives under
 * `/app/:id/{section}` routes and is opt-in for now.
 */
import { Link, NavLink, useParams, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  MessageSquare,
  Workflow,
  Clock,
  KeyRound,
  Cpu,
  ScrollText,
  ArrowLeft,
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
    { to: `${base}/dashboard`, label: 'Dashboard', icon: LayoutDashboard, testId: 'inner-nav-dashboard' },
    { to: `${base}/canvas`,    label: 'Canvas',    icon: Boxes,           testId: 'inner-nav-canvas' },
    { to: `${base}/chat`,      label: 'Chat',      icon: MessageSquare,   testId: 'inner-nav-chat' },
  ];

  const systemSection: NavItemDef[] = [
    { to: `${base}/system/flow`,    label: 'Module Flow', icon: Workflow,    testId: 'inner-nav-system-flow' },
    { to: `${base}/system/cron`,    label: 'Cron',        icon: Clock,       testId: 'inner-nav-system-cron' },
    { to: `${base}/system/secrets`, label: 'Secrets',     icon: KeyRound,    testId: 'inner-nav-system-secrets' },
    { to: `${base}/system/runners`, label: 'Runners',     icon: Cpu,         testId: 'inner-nav-system-runners' },
    { to: `${base}/system/logs`,    label: 'Logs',        icon: ScrollText,  testId: 'inner-nav-system-logs' },
  ];

  return (
    <div className="flex flex-col h-screen">
      <AppTopBar title={title} showBackToApps />
      <div className="flex flex-1 min-h-0">
        <AppInnerSidebar appSection={appSection} systemSection={systemSection} appId={id ?? ''} />
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
  systemSection,
  appId,
}: {
  appSection: NavItemDef[];
  systemSection: NavItemDef[];
  appId: string;
}) {
  return (
    <aside
      data-testid="app-inner-sidebar"
      className="w-[208px] h-full border-r border-border bg-background flex flex-col shrink-0"
    >
      {/* Back to all apps */}
      <div className="p-2 border-b border-border">
        <Link
          to="/apps"
          data-testid="inner-back-to-apps"
          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Apps</span>
        </Link>
      </div>

      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        <NavSection label="App" testId="inner-nav-section-app" items={appSection} />
        <NavSection label="System" testId="inner-nav-section-system" items={systemSection} />
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
  // Active state via NavLink end-matching for robustness.
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
      <item.icon className="w-4 h-4" />
      <span>{item.label}</span>
    </NavLink>
  );
}

/** Helper for callers that want to know which inner route is active. */
export function useInnerSectionFromLocation() {
  const loc = useLocation();
  const m = loc.pathname.match(/^\/app\/[^/]+\/(.+)$/);
  return m?.[1] ?? null;
}
