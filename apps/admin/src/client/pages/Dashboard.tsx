import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Hash, Loader2, AlertCircle, Workflow, Plus, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { logtoClient } from '../lib/logto';
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
export default function Dashboard() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['dashboard', 'common', 'auth', 'nav']);

  useEffect(() => {
    (async () => {
      const authed = await logtoClient.isAuthenticated();
      if (!authed) {
        navigate('/', { replace: true });
        return;
      }
      try {
        const data = await apiJSON<MeResponse>('/api/me');
        setMe(data);
        // Load workflows list
        const wfData = await apiClient.get<{ workflows: WorkflowSummary[] }>('/api/workflows').catch(() => ({ workflows: [] }));
        setWorkflows(wfData.workflows);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const dateLocale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard:title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('dashboard:subtitle')}
          </p>
        </header>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('common:loading')}
          </div>
        )}

        {err && (
          <Card className="border-destructive">
            <CardContent className="pt-6 flex items-start gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm">{err}</p>
            </CardContent>
          </Card>
        )}

        {me && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Visits</CardDescription>
                  <CardTitle className="text-3xl">{me.user.visits}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>User ID</CardDescription>
                  <CardTitle className="text-3xl">#{me.user.id}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard:account.title')}</CardTitle>
                <CardDescription>{t('dashboard:account.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">{t('dashboard:account.field')}</TableHead>
                      <TableHead>{t('dashboard:account.value')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" /> Logto ID
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{me.user.logtoId}</code>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" /> Email
                      </TableCell>
                      <TableCell>
                        {me.user.email ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" /> {t('dashboard:account.createdAt')}
                      </TableCell>
                      <TableCell>
                        {new Date(me.user.createdAt).toLocaleString(dateLocale)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" /> {t('dashboard:account.status')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t('auth:loggedIn')}</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* My Workflows — PLANET-1050 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Workflow className="h-4 w-4" /> My Workflows
                    </CardTitle>
                    <CardDescription>Recent workflows for this workspace</CardDescription>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/workflows"><Plus className="h-4 w-4 mr-1" /> New</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {workflows.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    No workflows yet.{' '}
                    <Link to="/workflows" className="underline text-primary">Create your first</Link>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workflows.slice(0, 10).map((wf) => (
                        <TableRow key={wf.id} data-testid={`dashboard-wf-${wf.id}`}>
                          <TableCell className="font-medium">
                            <Link to={`/workflows/${wf.id}`} className="hover:underline text-primary">
                              {wf.name || <span className="text-muted-foreground italic">Unnamed</span>}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{wf.category || 'general'}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(wf.updatedAt).toLocaleString(dateLocale)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1">
                              <Link to={`/workflows/${wf.id}`} data-testid={`open-wf-${wf.id}`}>
                                Edit <ChevronRight className="h-3 w-3" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {workflows.length > 10 && (
                  <div className="pt-2 text-right">
                    <Button asChild size="sm" variant="link">
                      <Link to="/workflows">View all {workflows.length} workflows</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">JWT Claims</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs overflow-auto bg-muted p-3 rounded-md">
                  {JSON.stringify(me.claims, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
