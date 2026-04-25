/**
 * PLANET-1257: Dashboard "我的" as a dialog (primary entry from AppTopBar).
 * Shows user info, stats, and recent workflows in a dialog.
 * The /dashboard route still works for direct URL access.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Mail,
  Calendar,
  Hash,
  Loader2,
  AlertCircle,
  Workflow,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { apiJSON, apiClient } from '../lib/api';

type MeResponse = {
  user: {
    id: number;
    logtoId: string;
    email: string | null;
    visits: number;
    createdAt: string;
  };
  claims: Record<string, unknown>;
};

interface WorkflowSummary {
  id: string;
  name: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DashboardDialog({ open, onOpenChange }: DashboardDialogProps) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const { t, i18n } = useTranslation(['dashboard', 'common', 'auth']);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const data = await apiJSON<MeResponse>('/api/me');
        setMe(data);
        const wfData = await apiClient
          .get<{ workflows: WorkflowSummary[] }>('/api/workflows')
          .catch(() => ({ workflows: [] }));
        setWorkflows(wfData.workflows);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const dateLocale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dashboard-dialog">
        <DialogHeader>
          <DialogTitle>我的</DialogTitle>
          <DialogDescription>{t('dashboard:subtitle')}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('common:loading')}
          </div>
        )}

        {err && (
          <div className="flex items-start gap-2 text-destructive py-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">{err}</p>
          </div>
        )}

        {me && (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardDescription className="text-xs">Visits</CardDescription>
                  <CardTitle className="text-2xl">{me.user.visits}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardDescription className="text-xs">User ID</CardDescription>
                  <CardTitle className="text-2xl">#{me.user.id}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Account info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('dashboard:account.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span>{me.user.email ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('dashboard:account.createdAt')}:</span>
                  <span>{new Date(me.user.createdAt).toLocaleString(dateLocale)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('dashboard:account.status')}:</span>
                  <Badge variant="secondary" className="text-[10px]">{t('auth:loggedIn')}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Logto ID:</span>
                  <code className="text-xs">{me.user.logtoId}</code>
                </div>
              </CardContent>
            </Card>

            {/* Recent workflows */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Workflow className="h-3.5 w-3.5" /> My Workflows
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">{workflows.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {workflows.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No workflows yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {workflows.slice(0, 5).map((wf) => (
                      <div
                        key={wf.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">
                            {wf.name || <span className="text-muted-foreground italic">Unnamed</span>}
                          </span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {wf.category || 'general'}
                          </Badge>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs gap-0.5 shrink-0"
                          onClick={() => onOpenChange(false)}
                        >
                          <Link to={`/workflows/${wf.id}`}>
                            Edit <ChevronRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                    {workflows.length > 5 && (
                      <div className="pt-1 text-right">
                        <Button
                          asChild
                          size="sm"
                          variant="link"
                          className="text-xs h-6"
                          onClick={() => onOpenChange(false)}
                        >
                          <Link to="/workflows">View all {workflows.length} workflows</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
