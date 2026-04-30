/**
 * PLANET-1385: Minimal top bar for chat-first layout.
 */
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';
import UserMenu from './UserMenu';
import TenantSwitcher from './TenantSwitcher';

export default function AppTopBar() {
  return (
    <div className="flex items-center gap-2 px-4 h-12 border-b bg-background/95 backdrop-blur shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-primary-foreground bg-gradient-to-br from-primary to-accent shadow">
          P
        </div>
        <span className="text-sm font-semibold tracking-tight">PeopleClaw</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <TenantSwitcher />
      <ThemeToggle />
      <LanguageToggle />
      <UserMenu />
    </div>
  );
}
