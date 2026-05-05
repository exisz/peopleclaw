/**
 * PLANET-1407: Living SaaS — System / Cron page.
 * Wraps the existing AppScheduledTasksPanel with the app's component list.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppScheduledTasksPanel } from '../../components/AppScheduledTasksPanel';
import { apiClient } from '../../lib/api';

interface Component { id: string; name: string; type: string }

export default function AppCronPage() {
  const { id } = useParams<{ id: string }>();
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .get<{ app: { components: Component[] } }>(`/api/apps/${id}`)
      .then(d => setComponents(d.app.components ?? []))
      .catch(() => setComponents([]))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div data-testid="page-app-system-cron" className="h-full overflow-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">Cron</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Scheduled component invocations on a cron expression.
        </p>
      </header>
      <div className="p-6">
        {!id ? (
          <p className="text-sm text-muted-foreground">No app selected.</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <AppScheduledTasksPanel appId={id} components={components} />
        )}
      </div>
    </div>
  );
}
