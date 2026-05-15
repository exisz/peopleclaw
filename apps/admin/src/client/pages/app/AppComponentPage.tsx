/**
 * PLANET-1742 — User/business component page.
 *
 * Components are user-defined App pages and are addressed directly from the
 * Living SaaS sidebar. This preserves deep links without using the old canvas
 * top-tab route layer.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import ComponentTabContent from '../../components/canvas/ComponentTabContent';
import { useComponentRun } from '../../components/canvas/useComponentRun';
import { apiClient, apiFetch } from '../../lib/api';

interface Component {
  id: string;
  name: string;
  type: string;
  runtime?: string;
}

export default function AppComponentPage() {
  const navigate = useNavigate();
  const { id: appId, componentId } = useParams<{ id: string; componentId: string }>();
  const [authChecked, setAuthChecked] = useState(false);
  const [components, setComponents] = useState<Component[]>([]);
  const { getState, runComponent } = useComponentRun();

  useEffect(() => {
    apiFetch('/api/me')
      .then(r => { if (!r.ok) { navigate('/signin'); return; } setAuthChecked(true); })
      .catch(() => navigate('/signin'));
  }, [navigate]);

  useEffect(() => {
    if (!appId) return;
    apiClient
      .get<{ app: { components: Component[] } }>(`/api/apps/${appId}`)
      .then(d => setComponents(d.app.components ?? []))
      .catch(() => setComponents([]));
  }, [appId]);

  const component = useMemo(
    () => components.find(c => c.id === componentId),
    [components, componentId],
  );

  if (!authChecked) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;
  }
  if (!appId || !componentId) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No component selected</div>;
  }
  if (!component) {
    return (
      <div data-testid="page-app-component-not-found" className="h-full p-6 text-sm text-muted-foreground">
        Component deleted or not found.
      </div>
    );
  }

  return (
    <div data-testid="page-app-component" className="h-full overflow-auto bg-background">
      <ComponentTabContent
        component={component}
        runState={getState(component.id)}
        onRun={() => runComponent(component.id)}
        defaultTab={component.type === 'FRONTEND' ? 'preview' : 'flow'}
        isActive
      />
    </div>
  );
}
