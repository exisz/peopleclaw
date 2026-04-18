import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, User as UserIcon, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { logtoClient, postSignOutRedirectUri } from '../lib/logto';
import { apiJSON } from '../lib/api';

interface UserSummary {
  email: string | null;
  name?: string | null;
}

function initialsFor(s: string | null | undefined): string {
  if (!s) return '?';
  const cleaned = s.split('@')[0].replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join('').toUpperCase();
}

/**
 * PLANET-932 Bug 5: replace bare "Sign out" button with avatar dropdown
 * (Profile / Settings / Sign out).
 */
export default function UserMenu() {
  const { t } = useTranslation(['auth', 'common']);
  const [user, setUser] = useState<UserSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiJSON<{ user: { email: string | null; name?: string | null } }>(
          '/api/me',
        );
        setUser({ email: data.user.email, name: data.user.name ?? null });
      } catch {
        // ignore — fall back to placeholder
      }
    })();
  }, []);

  const initials = initialsFor(user?.name ?? user?.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full font-medium"
          data-testid="user-menu-trigger"
          aria-label={t('common:userMenu', { defaultValue: 'User menu' })}
        >
          <span className="text-xs">{initials}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium truncate">
              {user?.name || user?.email || '—'}
            </span>
            {user?.email && user?.name && (
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard" data-testid="user-menu-profile">
            <UserIcon className="h-4 w-4" />
            {t('common:nav.profile', { defaultValue: 'Profile' })}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" data-testid="user-menu-settings">
            <SettingsIcon className="h-4 w-4" />
            {t('common:nav.settings', { defaultValue: 'Settings' })}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logtoClient.signOut(postSignOutRedirectUri)}
          data-testid="user-menu-signout"
        >
          <LogOut className="h-4 w-4" />
          {t('auth:signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
