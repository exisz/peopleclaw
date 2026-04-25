/**
 * PLANET-1257: Settings as a dialog (primary entry from AppTopBar).
 * Renders Connections / Team / Billing tabs inside a Dialog.
 * The /settings route still works for direct URL access.
 */
import { useState } from 'react';
import { Plug, Users, CreditCard } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { ErrorBoundary } from './ErrorBoundary';
import SettingsConnections from '../pages/SettingsConnections';
import SettingsTeam from '../pages/SettingsTeam';
import SettingsBilling from '../pages/SettingsBilling';

export default function SettingsDialog({
  open,
  onOpenChange,
  defaultTab = 'connections',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}) {
  const VALID_TABS = ['connections', 'team', 'billing'] as const;
  const initial = (VALID_TABS as readonly string[]).includes(defaultTab) ? defaultTab : 'connections';
  const [tab, setTab] = useState(initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>管理连接、团队和账单</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} data-testid="settings-dialog-tabs">
          <TabsList>
            <TabsTrigger value="connections" data-testid="settings-dialog-tab-connections">
              <Plug className="h-4 w-4 mr-1" /> Connections
            </TabsTrigger>
            <TabsTrigger value="team" data-testid="settings-dialog-tab-team">
              <Users className="h-4 w-4 mr-1" /> Team
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="settings-dialog-tab-billing">
              <CreditCard className="h-4 w-4 mr-1" /> Billing
            </TabsTrigger>
          </TabsList>
          <TabsContent value="connections" className="mt-4">
            <ErrorBoundary>
              <SettingsConnections />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="team" className="mt-4">
            <ErrorBoundary>
              <SettingsTeam />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="billing" className="mt-4">
            <ErrorBoundary>
              <SettingsBilling />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
