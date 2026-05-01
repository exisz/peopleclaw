/**
 * PLANET-1431: Settings page — content only, AppShell provides chrome.
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Plug, Users, CreditCard } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import SettingsConnections from './SettingsConnections';
import SettingsTeam from './SettingsTeam';
import SettingsBilling from './SettingsBilling';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const { tab: tabFromPath } = useParams();
  const VALID_TABS = ['connections', 'team', 'billing'] as const;
  const tabRaw = tabFromPath ?? params.get('tab') ?? 'connections';
  const tab = (VALID_TABS as readonly string[]).includes(tabRaw) ? tabRaw : 'connections';

  return (
    <div className="p-6 md:p-10 h-full overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

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
                <ErrorBoundary><SettingsConnections /></ErrorBoundary>
              </TabsContent>
              <TabsContent value="team" className="mt-4">
                <ErrorBoundary><SettingsTeam /></ErrorBoundary>
              </TabsContent>
              <TabsContent value="billing" className="mt-4">
                <ErrorBoundary><SettingsBilling /></ErrorBoundary>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
