import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../lib/api';
import CreditsBadge from '../components/CreditsBadge';

interface CaseStep {
  id: string;
  stepId: string;
  stepType: string;
  kind: string;
  status: string;
  output: string;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
interface CaseRow {
  id: string;
  workflowId: string;
  title: string;
  status: string;
  currentStepId: string | null;
  payload: string;
  createdAt: string;
  updatedAt: string;
  steps?: CaseStep[];
  workflow?: { name: string };
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  waiting_human: 'secondary',
  done: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
};

function CaseDetail({ id }: { id: string }) {
  const [c, setC] = useState<CaseRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiClient.get<{ case: CaseRow }>(`/api/cases/${id}`);
      setC(d.case);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Failed to load case', { description: msg });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-poll while running
  useEffect(() => {
    if (!c) return;
    if (c.status === 'running') {
      const t = setInterval(load, 3000);
      return () => clearInterval(t);
    }
  }, [c, load]);

  if (err) return <div className="p-10">Error: {err}</div>;
  if (!c) {
    return (
      <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const waitingStep = c.steps?.find((s) => s.status === 'waiting_human');

  async function advance(action: 'approve' | 'reject') {
    if (!waitingStep) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/api/cases/${id}/advance`, {
        stepId: waitingStep.stepId,
        output: { comment, approved: action === 'approve' },
        action,
      });
      setComment('');
      await load();
      toast.success(action === 'approve' ? 'Step approved' : 'Step rejected');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Failed to advance case', { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/cases"><ArrowLeft className="h-4 w-4" /> All cases</Link>
        </Button>
        <CreditsBadge />
      </div>

      <Card data-testid={`case-detail-${c.id}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{c.title}</CardTitle>
              <CardDescription>
                {c.workflow?.name ?? c.workflowId} · {new Date(c.createdAt).toLocaleString()}
              </CardDescription>
            </div>
            <Badge variant={STATUS_COLORS[c.status] ?? 'default'}>{c.status}</Badge>
          </div>
        </CardHeader>
      </Card>

      {waitingStep && (
        <Card className="border-yellow-500/40">
          <CardHeader>
            <CardTitle>Action required: {waitingStep.stepType}</CardTitle>
            <CardDescription>Step id: {waitingStep.stepId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Optional comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={() => advance('approve')} disabled={submitting} data-testid="human-action-approve">
                Approve & continue
              </Button>
              <Button
                onClick={() => advance('reject')}
                variant="outline"
                disabled={submitting}
                data-testid="human-action-reject"
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="case-step-timeline">
        <CardHeader>
          <CardTitle>Step timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(c.steps ?? []).map((s) => {
            let outPreview = s.output;
            try {
              const parsed = JSON.parse(s.output);
              outPreview = JSON.stringify(parsed, null, 2);
            } catch {}
            const dur =
              s.startedAt && s.completedAt
                ? Math.round((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 100) / 10 + 's'
                : '—';
            return (
              <div key={s.id} className="border rounded-md p-3" data-testid={`case-step-${s.stepId}-status`}>
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">
                    {s.stepId} <span className="text-muted-foreground font-normal">({s.stepType})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{s.kind}</Badge>
                    <Badge variant={STATUS_COLORS[s.status] ?? 'default'}>{s.status}</Badge>
                    <span className="text-xs text-muted-foreground">{dur}</span>
                  </div>
                </div>
                {s.error && <p className="mt-2 text-xs text-red-600">{s.error}</p>}
                {outPreview && outPreview !== '{}' && (
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-48">{outPreview}</pre>
                )}
              </div>
            );
          })}
          {(!c.steps || c.steps.length === 0) && (
            <p className="text-sm text-muted-foreground">No steps yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const FILTERS = ['all', 'running', 'waiting_human', 'done', 'failed', 'cancelled'] as const;

function CasesList() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const url = filter === 'all' ? '/api/cases' : `/api/cases?status=${filter}`;
    apiClient
      .get<{ cases: CaseRow[] }>(url)
      .then((d) => { if (!cancelled) setCases(d.cases); })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          setErr(msg);
          toast.error('Failed to load cases', { description: msg });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground mt-1">{cases.length} cases</p>
        </div>
        <CreditsBadge />
      </header>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Badge
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter(f)}
          >
            {f}
          </Badge>
        ))}
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="cases-table">
        {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        {!loading && cases.map((c) => (
          <Link key={c.id} to={`/cases/${c.id}`} data-testid={`case-row-${c.id}`}>
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{c.title}</CardTitle>
                  <Badge variant={STATUS_COLORS[c.status] ?? 'default'}>{c.status}</Badge>
                </div>
                <CardDescription className="text-xs">{c.workflowId}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Updated {new Date(c.updatedAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!loading && cases.length === 0 && !err && (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>No cases yet</CardTitle>
              <CardDescription>
                Start a workflow run from the Workflows page to create your first case.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function Cases() {
  const { id } = useParams<{ id?: string }>();
  return id ? <CaseDetail id={id} /> : <CasesList />;
}
