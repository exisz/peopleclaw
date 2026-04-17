import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { apiJSON, apiFetch } from '../lib/api';
import CreditsBadge from '../components/CreditsBadge';

interface WorkflowDef {
  id: string;
  name: string;
  category: string | null;
  definition: { nodes: Array<{ id: string; type: string; kind: string; config?: { fields?: string[] } }>; edges: Array<{ source: string; target: string }> };
}

export default function RunWorkflow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [wf, setWf] = useState<WorkflowDef | null>(null);
  const [title, setTitle] = useState('');
  const [fieldVals, setFieldVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiJSON<{ workflow: WorkflowDef }>(`/api/workflows/${id}`)
      .then((d) => setWf(d.workflow))
      .catch((e) => setErr(String(e)));
  }, [id]);

  if (err) return <div className="p-10">Error: {err}</div>;
  if (!wf) return <div className="p-10">Loading…</div>;

  const firstNode = wf.definition.nodes[0];
  const fields = (firstNode?.config?.fields as string[]) || ['title', 'features', 'vendor'];

  async function submit() {
    setBusy(true);
    try {
      const res = await apiFetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: id,
          title: title || `${wf.name} run`,
          payload: fieldVals,
        }),
      });
      if (!res.ok) {
        setErr(`HTTP ${res.status}: ${await res.text()}`);
        return;
      }
      const { case: c } = await res.json();
      navigate(`/cases/${c.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <Link to="/workflows" className="text-sm underline">
          ← Workflows
        </Link>
        <CreditsBadge />
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Start: {wf.name}</CardTitle>
          <CardDescription>{wf.category}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Case title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friendly name for this run" />
          </div>
          {fields.map((f) => (
            <div key={f} className="space-y-1">
              <Label>{f}</Label>
              {f === 'features' || f === 'description' ? (
                <Textarea
                  value={fieldVals[f] ?? ''}
                  onChange={(e) => setFieldVals({ ...fieldVals, [f]: e.target.value })}
                />
              ) : (
                <Input
                  value={fieldVals[f] ?? ''}
                  onChange={(e) => setFieldVals({ ...fieldVals, [f]: e.target.value })}
                />
              )}
            </div>
          ))}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button onClick={submit} disabled={busy} data-testid="case-create-submit" className="w-full">
            {busy ? 'Starting…' : 'Start case'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
