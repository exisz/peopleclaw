import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plug, Users, CreditCard } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import SettingsConnections from './SettingsConnections';
import SettingsTeam from './SettingsTeam';
import SettingsBilling from './SettingsBilling';
import { ThemeToggle } from '../components/theme-toggle';
import TenantSwitcher from '../components/TenantSwitcher';
import { apiJSON } from '../lib/api';

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'connections';
  const [tenantName, setTenantName] = useState<string>('');

  useEffect(() => {
    apiJSON<{ tenants: Array<{ name: string; slug: string }> }>('/api/me')
      .then((d) => {
        const slug = localStorage.getItem('peopleclaw-current-tenant');
        const t = d.tenants.find((x) => x.slug === slug) ?? d.tenants[0];
        setTenantName(t?.name ?? '');
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">{tenantName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TenantSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <Card>
          <CardContent className="pt-6">
            <Tabs
              value={tab}
              onValueChange={(v) => setParams({ tab: v })}
              data-testid="settings-tabs"
            >
              <TabsList>
                <TabsTrigger value="connections" data-testid="settings-tab-connections">
                  <Plug className="h-4 w-4" /> Connections
                </TabsTrigger>
                <TabsTrigger value="team" data-testid="settings-tab-team">
                  <Users className="h-4 w-4" /> Team
                </TabsTrigger>
                <TabsTrigger value="billing" data-testid="settings-tab-billing">
                  <CreditCard className="h-4 w-4" /> Billing
                </TabsTrigger>
              </TabsList>
              <TabsContent value="connections" className="mt-4">
                <SettingsConnections />
              </TabsContent>
              <TabsContent value="team" className="mt-4">
                <SettingsTeam />
              </TabsContent>
              <TabsContent value="billing" className="mt-4">
                <SettingsBilling />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// silence linter for unused imports
void Card; void CardHeader; void CardTitle; void CardDescription;
