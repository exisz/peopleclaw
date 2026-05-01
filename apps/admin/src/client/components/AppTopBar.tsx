/**
 * PLANET-1431: Unified AppTopBar with dynamic title.
 */
import { Link } from 'react-router-dom';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';
import UserMenu from './UserMenu';
import TenantSwitcher from './TenantSwitcher';

interface AppTopBarProps {
  title?: string;
}

export default function AppTopBar({ title }: AppTopBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 h-12 border-b bg-background/95 backdrop-blur shrink-0">
      {/* Brand */}
      <Link to="/apps" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-primary-foreground bg-gradient-to-br from-primary to-accent shadow">
          P
        </div>
        <span className="text-sm font-semibold tracking-tight">PeopleClaw</span>
      </Link>

      {/* Center title */}
      {title && (
        <div className="flex-1 flex justify-center">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
      )}
      {!title && <div className="flex-1" />}

      {/* Right side controls */}
      <TenantSwitcher />
      <ThemeToggle />
      <LanguageToggle />
      <UserMenu />
    </div>
  );
}
