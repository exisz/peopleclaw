/**
 * PLANET-1429/1431: Apps 列表页 (类 Replit Projects 视图)
 * Now renders content only — AppShell provides topbar + sidebar.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { apiFetch, apiClient } from '../lib/api';

interface App {
  id: string;
  name: string;
  description?: string | null;
  updatedAt?: string;
}

export default function AppsList() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string; componentCount: number }[]>([]);

  useEffect(() => {
    apiFetch('/api/me')
      .then(r => { if (!r.ok) { navigate('/signin'); return null; } return r.json(); })
      .then(() => {
        apiClient.get<{ apps: App[] }>('/api/apps').then(d => {
          setApps(d.apps);
          setLoading(false);
        }).catch(() => setLoading(false));
        apiClient.get<{ templates: typeof templates }>('/api/apps/templates')
          .then(d => setTemplates(d.templates))
          .catch(() => {});
      })
      .catch(() => navigate('/signin'));
  }, [navigate]);

  const createFromTemplate = async (templateId: string) => {
    setShowTemplatePicker(false);
    const d = await apiClient.post<{ app: { id: string; name: string } }>('/api/apps/from-template', { templateId });
    navigate(`/app/${d.app.id}`);
  };

  const createBlankApp = async () => {
    setShowTemplatePicker(false);
    const name = prompt('App 名称:');
    if (!name) return;
    const d = await apiClient.post<{ app: { id: string; name: string } }>('/api/apps', { name });
    navigate(`/app/${d.app.id}`);
  };

  const filteredApps = apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Search + filters */}
      <div className="px-6 py-4 flex items-center gap-3">
        <h1 data-testid="apps-list-title" className="text-xl font-semibold">📦 Apps</h1>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search apps..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Create card */}
          <button
            data-testid="create-new-app-card"
            onClick={() => setShowTemplatePicker(true)}
            className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-muted/50 transition-colors min-h-[160px]"
          >
            <Plus className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">+ Create new app</span>
          </button>

          {/* App cards */}
          {filteredApps.map(app => (
            <button
              key={app.id}
              data-testid={`app-card-${app.id}`}
              onClick={() => navigate(`/app/${app.id}`)}
              className="border border-border rounded-lg p-4 text-left hover:border-primary hover:shadow-sm transition-all min-h-[160px] flex flex-col"
            >
              <div className="w-full h-20 bg-muted rounded mb-3 flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
              <h3 className="text-sm font-medium text-foreground truncate">{app.name}</h3>
              {app.updatedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(app.updatedAt).toLocaleDateString()}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Template picker modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" data-testid="template-picker-overlay" onClick={() => setShowTemplatePicker(false)}>
          <div className="bg-background border border-border rounded-lg shadow-xl p-6 w-96 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">选择模板</h3>
            <div className="space-y-2">
              <button
                data-testid="template-blank-btn"
                onClick={createBlankApp}
                className="w-full text-left p-3 rounded border border-border hover:bg-muted transition"
              >
                <span className="font-medium">📄 空白 App</span>
                <p className="text-xs text-muted-foreground">从零开始</p>
              </button>
              {templates.map(t => (
                <button
                  key={t.id}
                  data-testid={`template-${t.id}-btn`}
                  onClick={() => createFromTemplate(t.id)}
                  className="w-full text-left p-3 rounded border border-border hover:bg-muted transition"
                >
                  <span className="font-medium">{t.name}</span>
                  <p className="text-xs text-muted-foreground">{t.description} ({t.componentCount} 组件)</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
