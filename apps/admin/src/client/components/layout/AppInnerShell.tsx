/**
 * PLANET-1742: Living SaaS shell for inside-an-App navigation.
 *
 * Single App shell rule:
 *   - Left sidebar is the route source of truth.
 *   - Chat / Canvas / System pages / user-defined component pages are peer
 *     sidebar entries.
 *   - No second top route/tab row is rendered inside page content.
 */
import { useEffect, useMemo, useState } from 'react';
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
  Puzzle,
  List,
} from 'lucide-react';
import AppTopBar from '../AppTopBar';
import { cn } from '../../lib/utils';
import { apiClient } from '../../lib/api';

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

interface ComponentSummary {
  id: string;
  name: string;
}

interface AppInnerShellProps {
  /** Optional title shown in the top bar centre. */
  title?: string;
  children: React.ReactNode;
}

export default function AppInnerShell({ title, children }: AppInnerShellProps) {
  const { id } = useParams<{ id: string }>();
  const base = `/app/${id ?? ''}`;
  const [components, setComponents] = useState<ComponentSummary[]>([]);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<{ app: { components: ComponentSummary[] } }>(`/api/apps/${id}`)
      .then(d => setComponents(d.app.components ?? []))
      .catch(() => setComponents([]));
  }, [id]);

  const appSection: NavItemDef[] = [
    { to: `${base}/dashboard`, label: 'Dashboard', icon: LayoutDashboard, testId: 'inner-nav-dashboard' },
    { to: `${base}/canvas`,    label: 'Canvas',    icon: Boxes,           testId: 'inner-nav-canvas' },
    { to: `${base}/modules`,   label: 'Modules',   icon: List,            testId: 'inner-nav-modules' },
    { to: `${base}/chat`,      label: 'Chat',      icon: MessageSquare,   testId: 'inner-nav-chat' },
  ];

  const componentSection: NavItemDef[] = useMemo(() => components.map(c => ({
    to: `${base}/components/${c.id}`,
    label: c.name,
    icon: Puzzle,
    testId: `inner-nav-component-${c.id}`,
  })), [base, components]);

  const systemSection: NavItemDef[] = [
    { to: `${base}/system/flow`,    label: 'Module Flow', icon: Workflow,    testId: 'inner-nav-system-flow' },
    { to: `${base}/system/cron`,    label: 'Cron',        icon: Clock,       testId: 'inner-nav-system-cron' },
    { to: `${base}/system/secrets`, label: 'Secrets',     icon: KeyRound,    testId: 'inner-nav-system-secrets' },
    { to: `${base}/system/runners`, label: 'Runners',     icon: Cpu,         testId: 'inner-nav-system-runners' },
    { to: `${base}/system/logs`,    label: 'Logs',        icon: ScrollText,  testId: 'inner-nav-system-logs' },
  ];

  return (
    <div className="flex flex-col h-screen">
      <AppTopBar title={title} />
      <div className="flex flex-1 min-h-0">
        <AppInnerSidebar
          appSection={appSection}
          componentSection={componentSection}
          systemSection={systemSection}
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
  componentSection,
  systemSection,
  appId,
}: {
  appSection: NavItemDef[];
  componentSection: NavItemDef[];
  systemSection: NavItemDef[];
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
        <NavSection label="Pages" testId="inner-nav-section-components" items={componentSection} emptyLabel="No custom pages" />
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
  emptyLabel,
}: {
  label: string;
  testId: string;
  items: NavItemDef[];
  emptyLabel?: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.length === 0 && emptyLabel ? (
          <div className="px-2 py-1 text-xs text-muted-foreground/70">{emptyLabel}</div>
        ) : items.map(item => (
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
