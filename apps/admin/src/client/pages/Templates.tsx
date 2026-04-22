/**
 * PLANET-1103: Template library page.
 * Lists global workflow templates and allows one-click provisioning into the current tenant.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LayoutDashboard, Settings, BookOpen, LibraryBig, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { LanguageToggle } from '../components/language-toggle';
import UserMenu from '../components/UserMenu';
import { ThemeToggle } from '../components/theme-toggle';
import TenantSwitcher from '../components/TenantSwitcher';
import { apiClient } from '../lib/api';

interface TemplateStep {
  name: string;
}

interface Template {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  stepCount: number;
  steps: TemplateStep[];
}

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/api/templates')
      .then((data: unknown) => {
        const d = data as { templates: Template[] };
        setTemplates(d.templates ?? []);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`加载模板失败: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUse = async (t: Template) => {
    setUsingId(t.id);
    try {
      const data = await apiClient.post(`/api/templates/${t.id}/use`, {}) as { workflow: { id: string; name: string } };
      toast.success(`已创建工作流「${data.workflow.name}」`);
      navigate(`/workflows/${data.workflow.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`一键使用失败: ${msg}`);
      setUsingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-screen">
      {/* Top navigation bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-background" data-testid="app-topbar">
        <Button asChild size="sm" variant="ghost" className="text-xs gap-1.5">
          <Link to="/dashboard" data-testid="nav-dashboard">
            <LayoutDashboard className="h-4 w-4" /> 我的
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="text-xs gap-1.5">
          <Link to="/settings" data-testid="nav-settings">
            <Settings className="h-4 w-4" /> 设置
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="text-xs gap-1.5">
          <Link to="/settings/background" data-testid="nav-background-settings">
            <BookOpen className="h-4 w-4" /> 背景设定
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary" className="text-xs gap-1.5">
          <Link to="/templates" data-testid="nav-templates">
            <LibraryBig className="h-4 w-4" /> 模板库
          </Link>
        </Button>
        <div className="flex-1" />
        <TenantSwitcher />
        <ThemeToggle />
        <LanguageToggle />
        <UserMenu />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <LibraryBig className="h-6 w-6" /> 模板库
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              选择一个模板，一键创建工作流，快速上手。
            </p>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
            </div>
          )}

          {!loading && templates.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无模板。</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {templates.map((t) => (
              <Card key={t.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.category && (
                      <Badge variant="secondary" className="text-xs shrink-0">{t.category}</Badge>
                    )}
                  </div>
                  {t.description && (
                    <CardDescription className="text-xs">{t.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t.stepCount} 步
                    </p>
                    <ul className="space-y-0.5">
                      {t.steps.map((s, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-primary/60 shrink-0" />
                          {s.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-auto pt-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleUse(t)}
                      disabled={usingId !== null}
                      data-testid={`use-template-${t.id}`}
                    >
                      {usingId === t.id ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 创建中…</>
                      ) : (
                        '一键使用'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
