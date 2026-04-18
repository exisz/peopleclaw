import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, Plus } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { apiJSON, getCurrentTenantSlug, setCurrentTenantSlug } from '../lib/api';

interface TenantInfo {
  id: string; name: string; slug: string; plan: string; credits: number; role: string;
}

export default function TenantSwitcher() {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [current, setCurrent] = useState<string | null>(getCurrentTenantSlug());
  const navigate = useNavigate();

  useEffect(() => { reload(); }, []);

  async function reload() {
    try {
      const data = await apiJSON<{ tenants: TenantInfo[] }>('/api/me');
      setTenants(data.tenants);
      // If no current selection or invalid, pick first
      if (!current || !data.tenants.some((t) => t.slug === current)) {
        const first = data.tenants[0]?.slug ?? null;
        if (first) {
          setCurrentTenantSlug(first);
          setCurrent(first);
        }
      }
    } catch {/* */}
  }

  function pick(slug: string) {
    setCurrentTenantSlug(slug);
    setCurrent(slug);
    // Soft refresh by navigating to current path (forces re-fetch)
    navigate(0);
  }

  async function createNew() {
    const name = window.prompt('New workspace name?');
    if (!name) return;
    try {
      const r = await apiJSON<{ tenant: TenantInfo }>('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      pick(r.tenant.slug);
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const currentTenant = tenants.find((t) => t.slug === current) ?? tenants[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="tenant-switcher">
          <Building2 className="h-4 w-4" />
          <span data-testid="tenant-current-name">{currentTenant?.name ?? '—'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.slug}
            onClick={() => pick(t.slug)}
            data-testid={`tenant-option-${t.slug}`}
            className="py-2"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm leading-tight truncate">{t.name}</div>
              <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                <span className="capitalize">{t.plan}</span> · {t.credits} credits · {t.role}
              </div>
            </div>
            {t.slug === current && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={createNew} data-testid="tenant-create">
          <Plus className="h-4 w-4" />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
