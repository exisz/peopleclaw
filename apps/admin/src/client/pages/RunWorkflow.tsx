import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { apiClient } from '../lib/api';
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
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<{ workflow: WorkflowDef }>(`/api/workflows/${id}`)
      .then((d) => setWf(d.workflow))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
        toast.error('Failed to load workflow', { description: msg });
      });
  }, [id]);

  if (err) return <div className="p-10">Error: {err}</div>;
  if (!wf) {
    return (
      <div className="min-h-screen p-6 md:p-10 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const firstNode = wf.definition.nodes[0];
  const fields = (firstNode?.config?.fields as string[]) || ['title', 'features', 'vendor'];

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const { case: c } = await apiClient.post<{ case: { id: string } }>('/api/cases', {
        workflowId: id,
        title: title || `${wf!.name} run`,
        payload: fieldVals,
      });
      toast.success('Case started');
      navigate(`/cases/${c.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Failed to start case', { description: msg });
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
              <Label className="capitalize">{f === 'image' ? '🖼️ Product Image (URL or upload)' : f === 'price' ? '💰 Price' : f}</Label>
              {f === 'image' ? (
                <div className="space-y-2">
                  <Input
                    placeholder="https://... or paste image URL"
                    value={fieldVals[f] ?? ''}
                    onChange={(e) => setFieldVals({ ...fieldVals, [f]: e.target.value })}
                    data-testid="entry-image-url"
                  />
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => imageInputRef.current?.click()}>
                      Upload file
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {fieldVals[f] ? '✓ image set' : 'no image'}
                    </span>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        setFieldVals((prev) => ({ ...prev, [f]: dataUrl }));
                        toast.success(`Image loaded: ${file.name}`);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {fieldVals[f]?.startsWith('data:image') && (
                    <img src={fieldVals[f]} alt="preview" className="h-24 w-auto rounded border object-cover" />
                  )}
                </div>
              ) : f === 'price' ? (
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 29.99"
                  value={fieldVals[f] ?? ''}
                  onChange={(e) => setFieldVals({ ...fieldVals, [f]: e.target.value })}
                  data-testid="entry-price"
                />
              ) : f === 'features' || f === 'description' ? (
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
