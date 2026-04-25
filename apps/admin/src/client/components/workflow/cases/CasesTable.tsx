import { useTranslation } from 'react-i18next';
import type { Workflow } from '../../../types';
import type { CaseRecord, CaseStepRecord } from './types';
import { ScrollArea } from '../../ui/scroll-area';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { CaseRow } from './CaseRow';

interface CasesTableProps {
  filtered: CaseRecord[] | null;
  workflow: Workflow;
  selectedCaseId?: string | null;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  completing: string | null;
  continuing: string | null;
  runningAi: string | null;
  loadingSteps: string | null;
  onNavigate: (caseId: string) => void;
  onDelete: (c: CaseRecord) => void;
  onComplete: (c: CaseRecord) => void;
  onContinue: (c: CaseRecord) => void;
  onRunAi: (c: CaseRecord) => void;
  onOpenPayload: (c: CaseRecord) => void;
  onOpenSteps: (c: CaseRecord) => void;
}

export function CasesTable({
  filtered,
  workflow,
  selectedCaseId,
  selectedIds,
  setSelectedIds,
  completing,
  continuing,
  runningAi,
  loadingSteps,
  onNavigate,
  onDelete,
  onComplete,
  onContinue,
  onRunAi,
  onOpenPayload,
  onOpenSteps,
}: CasesTableProps) {
  const { t } = useTranslation('workflow');

  if (!filtered) {
    return <p className="text-xs text-muted-foreground p-4 text-center">Loading…</p>;
  }

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground p-4 text-center">
        {t('cases.empty', { defaultValue: 'No cases for this filter.' })}
      </p>
    );
  }

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <ScrollArea className="flex-1">
      <Table>
        <TableHeader>
          <TableRow className="text-[10px]">
            <TableHead className="h-7 w-8 px-2">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(filtered.map((c) => c.id)));
                  else setSelectedIds(new Set());
                }}
              />
            </TableHead>
            <TableHead className="h-7 px-2">案例名称</TableHead>
            <TableHead className="h-7 px-2 w-[72px]">状态</TableHead>
            <TableHead className="h-7 px-2 w-[90px]">当前步骤</TableHead>
            <TableHead className="h-7 px-2 w-[70px]">创建时间</TableHead>
            <TableHead className="h-7 px-2 w-[36px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c) => (
            <CaseRow
              key={c.id}
              c={c}
              workflow={workflow}
              isSelected={selectedCaseId === c.id}
              isChecked={selectedIds.has(c.id)}
              completing={completing}
              continuing={continuing}
              runningAi={runningAi}
              loadingSteps={loadingSteps}
              onNavigate={onNavigate}
              onToggleSelect={handleToggleSelect}
              onDelete={onDelete}
              onComplete={onComplete}
              onContinue={onContinue}
              onRunAi={onRunAi}
              onOpenPayload={onOpenPayload}
              onOpenSteps={onOpenSteps}
            />
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
