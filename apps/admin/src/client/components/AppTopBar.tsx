/**
 * PLANET-1257: Global persistent top navigation bar.
 * Shared across all authenticated pages via AppLayout.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Workflow, LibraryBig, Settings as SettingsIcon } from 'lucide-react';
import { Button } from './ui/button';
import TenantSwitcher from './TenantSwitcher';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';
import UserMenu from './UserMenu';
import TemplateLibraryDialog from './TemplateLibraryDialog';
import SettingsDialog from './SettingsDialog';
import DashboardDialog from './DashboardDialog';

const NAV_ITEMS = [
  { to: '/workflows', label: '工作流', icon: Workflow, testId: 'nav-workflows' },
] as const;

export default function AppTopBar() {
  const location = useLocation();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-background shrink-0" data-testid="app-topbar">
        {/* Brand logo + name */}
        <div className="flex items-center gap-2 mr-3 shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-primary-foreground bg-gradient-to-br from-primary to-accent shadow">
            P
          </div>
          <div className="leading-none">
            <span className="text-sm font-bold tracking-tight">PeopleClaw</span>
            <span className="block text-[8px] font-mono text-muted-foreground tracking-widest uppercase">工作流程引擎</span>
          </div>
        </div>
        <div className="mx-1 h-5 border-l border-border" />
        <Button
          size="sm"
          variant="ghost"
          className="text-xs gap-1.5"
          onClick={() => setDashboardDialogOpen(true)}
          data-testid="nav-dashboard"
        >
          <LayoutDashboard className="h-4 w-4" /> 我的
        </Button>
        {NAV_ITEMS.map(({ to, label, icon: Icon, testId }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + '/');
          return (
            <Button
              key={to}
              asChild
              size="sm"
              variant={active ? 'secondary' : 'ghost'}
              className="text-xs gap-1.5"
            >
              <Link to={to} data-testid={testId}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            </Button>
          );
        })}
        <Button
          size="sm"
          variant={location.pathname.startsWith('/settings') ? 'secondary' : 'ghost'}
          className="text-xs gap-1.5"
          onClick={() => setSettingsDialogOpen(true)}
          data-testid="nav-settings"
        >
          <SettingsIcon className="h-4 w-4" /> 设置
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs gap-1.5"
          onClick={() => setTemplateDialogOpen(true)}
          data-testid="nav-templates"
        >
          <LibraryBig className="h-4 w-4" /> 模板库
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <TenantSwitcher />
          <ThemeToggle />
          <LanguageToggle />
          <UserMenu />
        </div>
      </div>
      <TemplateLibraryDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen} />
      <SettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
      <DashboardDialog open={dashboardDialogOpen} onOpenChange={setDashboardDialogOpen} />
    </>
  );
}
