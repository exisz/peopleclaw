import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { apiClient } from '../../lib/api';

interface ServerCaseStep {
  id: string;
  caseId: string;
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

interface ServerCase {
  id: string;
  workflowId: string;
  title: string;
  status: string;
  payload: string;
  createdAt: string;
  updatedAt: string;
  steps?: ServerCaseStep[];
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  done: 'outline',
  running: 'default',
  failed: 'destructive',
  waiting_human: 'secondary',
};

export default function RunsPanel({ workflowId }: { workflowId: string }) {
  const { t } = useTranslation('workflow');
  const [rows, setRows] = useState<{ caseTitle: string; step: ServerCaseStep }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const { cases } = await apiClient.get<{ cases: ServerCase[] }>('/api/cases');
        const wfCases = cases.filter((c) => c.workflowId === workflowId);
        // For each case, fetch detail to get steps (limit to top 20 cases to avoid load)
        const limited = wfCases.slice(0, 20);
        const details = await Promise.all(
          limited.map(async (c) => {
            try {
              const { case: full } = await apiClient.get<{ case: ServerCase }>(`/api/cases/${c.id}`);
              return full;
            } catch {
              return null;
            }
          }),
        );
        const flat: { caseTitle: string; step: ServerCaseStep }[] = [];
        for (const d of details) {
          if (!d?.steps) continue;
          for (const s of d.steps) flat.push({ caseTitle: d.title, step: s });
        }
        flat.sort((a, b) => Date.parse(b.step.createdAt) - Date.parse(a.step.createdAt));
        if (!cancelled) setRows(flat);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) timer = setTimeout(tick, 8000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [workflowId]);

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
          {t('runs.title', { defaultValue: 'Step Runs (audit log)' })}
        </h4>
        {!rows ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('runs.empty', { defaultValue: 'No step runs yet.' })}
          </p>
        ) : (
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1 pr-2">case</th>
                <th className="py-1 pr-2">step</th>
                <th className="py-1 pr-2">status</th>
                <th className="py-1 pr-2">dur</th>
                <th className="py-1 pr-2">when</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map(({ caseTitle, step }) => {
                const dur =
                  step.startedAt && step.completedAt
                    ? `${Math.max(0, Date.parse(step.completedAt) - Date.parse(step.startedAt))}ms`
                    : step.startedAt
                    ? '…'
                    : '-';
                const when = new Date(step.createdAt).toLocaleTimeString();
                return (
                  <tr key={step.id} className="border-b border-border/40" data-testid={`run-row-${step.id}`}>
                    <td className="py-1 pr-2 truncate max-w-[80px]" title={caseTitle}>
                      {caseTitle}
                    </td>
                    <td className="py-1 pr-2 truncate max-w-[100px]" title={step.stepId}>
                      {step.stepId}
                    </td>
                    <td className="py-1 pr-2">
                      <Badge variant={STATUS_VARIANT[step.status] ?? 'outline'} className="text-[9px]">
                        {step.status}
                      </Badge>
                    </td>
                    <td className="py-1 pr-2">{dur}</td>
                    <td className="py-1 pr-2 text-muted-foreground">{when}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </ScrollArea>
  );
}
