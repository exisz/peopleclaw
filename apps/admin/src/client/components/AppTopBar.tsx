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

const NAV_ITEMS = [
  { to: '/dashboard', label: '我的', icon: LayoutDashboard, testId: 'nav-dashboard' },
  { to: '/workflows', label: '工作流', icon: Workflow, testId: 'nav-workflows' },
] as const;

export default function AppTopBar() {
  const location = useLocation();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-background shrink-0" data-testid="app-topbar">
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
    </>
  );
}
