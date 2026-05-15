/** PLANET-1742 — module list as a sidebar-routed App page. */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, apiFetch } from '../../lib/api';
import { useComponentRun } from '../../components/canvas/useComponentRun';

interface Component {
  id: string;
  name: string;
  type: string;
  runtime?: string;
}

export default function AppModulesPage() {
  const navigate = useNavigate();
  const { id: appId } = useParams<{ id: string }>();
  const [authChecked, setAuthChecked] = useState(false);
  const [components, setComponents] = useState<Component[]>([]);
  const { getState } = useComponentRun();

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

  if (!authChecked) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;
  }

  return (
    <div data-testid="page-app-modules" className="h-full overflow-auto p-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Modules</h1>
        <p data-testid="module-list-count" className="text-xs text-muted-foreground">
          {components.length} user/business pages in this App
        </p>
      </header>
      {components.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No components</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-1">Name</th>
              <th className="text-left py-1">Type</th>
              <th className="text-left py-1">Runtime</th>
              <th className="text-left py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {components.map(c => {
              const st = getState(c.id);
              return (
                <tr
                  key={c.id}
                  data-testid={`module-list-row-${c.id}`}
                  onClick={() => navigate(`/app/${appId}/components/${c.id}`)}
                  className="border-b border-border/50 hover:bg-muted cursor-pointer"
                >
                  <td className="py-1">{c.name}</td>
                  <td className="py-1">{c.type}</td>
                  <td className="py-1">{c.runtime ?? '-'}</td>
                  <td className="py-1">
                    <span data-testid={`module-list-status-${c.id}`} className="text-muted-foreground">
                      {st.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
