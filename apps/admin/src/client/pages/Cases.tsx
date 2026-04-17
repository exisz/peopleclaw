import { Link, useParams } from 'react-router-dom';
import { cases as allCases } from '../data/cases';
import { workflows } from '../data/workflows';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Cases() {
  const { id } = useParams<{ id?: string }>();

  if (id) {
    const c = allCases.find((x) => x.id === id);
    if (!c) {
      return (
        <div className="min-h-screen p-10 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Case not found</CardTitle>
              <CardDescription>No case with id {id}.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/cases">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    const wf = workflows.find((w) => w.id === c.workflowId);

    return (
      <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/cases">
            <ArrowLeft className="h-4 w-4" /> All cases
          </Link>
        </Button>
        <Card data-testid={`case-detail-${c.id}`}>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>{c.name}</CardTitle>
                <CardDescription>
                  Workflow: {wf?.name ?? c.workflowId} · Started {c.startedAt}
                </CardDescription>
              </div>
              <Badge variant={c.status === 'completed' ? 'secondary' : 'default'}>{c.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Detailed case view is a P3 placeholder. Step statuses:
            </p>
            <pre className="mt-3 text-xs bg-muted p-3 rounded-md overflow-auto">
              {JSON.stringify(c.stepStatuses, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">All Cases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {allCases.length} cases across {workflows.length} workflows
        </p>
      </header>

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="cases-table"
      >
        {allCases.map((c) => {
          const wf = workflows.find((w) => w.id === c.workflowId);
          return (
            <Link key={c.id} to={`/cases/${c.id}`} data-testid={`case-row-${c.id}`}>
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{c.name}</CardTitle>
                    <Badge variant={c.status === 'completed' ? 'secondary' : 'default'}>
                      {c.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {wf?.icon} {wf?.name ?? c.workflowId}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-[10px] text-muted-foreground">Started {c.startedAt}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
