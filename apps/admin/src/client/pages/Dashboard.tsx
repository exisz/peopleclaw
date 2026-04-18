import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Mail, Calendar, Hash, Loader2, AlertCircle, Workflow, ListChecks, Settings } from 'lucide-react';
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
import { logtoClient, postSignOutRedirectUri } from '../lib/logto';
import { apiJSON } from '../lib/api';
import { ThemeToggle } from '../components/theme-toggle';
import TenantSwitcher from '../components/TenantSwitcher';
// TODO: extract shared layout/header (P3.8 may add tenant switcher) — for now ThemeToggle
// only lives on Dashboard. Mirror to Workflows/Cases/Credits/RunWorkflow once layout exists.

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

export default function Dashboard() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              已登录 · GET /api/me
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TenantSwitcher />
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link to="/workflows" data-testid="nav-workflows">
                <Workflow className="h-4 w-4" /> Workflows
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/cases" data-testid="nav-cases">
                <ListChecks className="h-4 w-4" /> Cases
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings" data-testid="nav-settings">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logtoClient.signOut(postSignOutRedirectUri)}
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>
        </header>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
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
                <CardTitle>账户信息</CardTitle>
                <CardDescription>来自 Prisma + Turso 的用户记录</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">字段</TableHead>
                      <TableHead>值</TableHead>
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
                        <Calendar className="h-4 w-4 text-muted-foreground" /> 创建时间
                      </TableCell>
                      <TableCell>
                        {new Date(me.user.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" /> 状态
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">已登录</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
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
