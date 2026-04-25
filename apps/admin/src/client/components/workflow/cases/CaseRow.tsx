import type { Workflow } from '../../../types';
import type { CaseRecord, CaseStepRecord } from './types';
import { STATUS_VARIANT, STATUS_LABEL } from './types';
import { Badge } from '../../ui/badge';
import { SimpleMenu, type MenuItem } from '../../ui/simple-menu';
import { cn } from '../../../lib/utils';
import {
  ClipboardList,
  ScrollText,
  Bot,
  Pencil,
  FastForward,
  CheckCircle,
  Trash2,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { TableCell, TableRow } from '../../ui/table';

/* ── Helpers ── */

function relTime(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  return `${days}天前`;
}

function resolveStepName(stepId: string | null, workflow: Workflow): string {
  if (!stepId) return '—';
  const step = workflow.steps?.find((s) => s.id === stepId);
  return step?.name ?? stepId;
}

function StepProgress({
  workflow,
  currentStepId,
  status,
}: {
  workflow: Workflow;
  currentStepId: string | null;
  status: string;
}) {
  const steps = workflow.steps ?? [];
  if (steps.length === 0) return null;
  const currentIdx = currentStepId ? steps.findIndex((s) => s.id === currentStepId) : -1;
  const isDone = status === 'done';
  const isFailed = status === 'failed';
  

  return (
    <div
      className="flex items-center gap-0.5"
      title={`${isDone ? steps.length : Math.max(0, currentIdx + 1)}/${steps.length} steps`}
    >
      {steps.map((s, i) => {
        let color: string;
        if (isDone) color = 'bg-green-500';
        else if (isFailed && i === currentIdx) color = 'bg-red-500';
        else if (i < currentIdx) color = 'bg-green-500';
        else if (i === currentIdx) color = 'bg-blue-500 animate-pulse';
        else color = 'bg-gray-300 dark:bg-gray-600';
        return (
          <div
            key={s.id}
            className={cn('h-1.5 rounded-full', color)}
            style={{ width: `${Math.max(4, Math.min(16, 80 / steps.length))}px` }}
            title={s.name}
          />
        );
      })}
    </div>
  );
}

/* ── Field Labels (Chinese) ── */

const FIELD_LABELS: Record<string, string> = {
  product_name: '商品名',
  price: '价格',
  stock: '库存',
  image_url: '商品图片',
  description: '描述',
  category: '分类',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

/* ── Props ── */

interface CaseRowProps {
  c: CaseRecord;
  workflow: Workflow;
  isSelected: boolean;
  isChecked: boolean;
  completing: string | null;
  continuing: string | null;
  runningAi: string | null;
  loadingSteps: string | null;
  onNavigate: (caseId: string) => void;
  onToggleSelect: (id: string, checked: boolean) => void;
  onDelete: (c: CaseRecord) => void;
  onComplete: (c: CaseRecord) => void;
  onContinue: (c: CaseRecord) => void;
  onRunAi: (c: CaseRecord) => void;
  onOpenPayload: (c: CaseRecord) => void;
  onOpenSteps: (c: CaseRecord) => void;
  onRename: (c: CaseRecord, newTitle: string) => void;
}

export function CaseRow({
  c,
  workflow,
  isSelected,
  isChecked,
  completing,
  continuing,
  runningAi,
  loadingSteps,
  onNavigate,
  onToggleSelect,
  onDelete,
  onComplete,
  onContinue,
  onRunAi,
  onOpenPayload,
  onOpenSteps,
  onRename,
}: CaseRowProps) {
  const isCompleting = completing === c.id;
  const isContinuing = continuing === c.id;
  const isRunningThisAi = runningAi === c.id;
  const isLoadingThisSteps = loadingSteps === c.id;

  // PLANET-1260: Parse payload to check for _missingFields and productPublicUrl
  const parsedPayload: Record<string, unknown> = (() => {
    try {
      return JSON.parse(c.payload || '{}');
    } catch {
      return {};
    }
  })();
  const missingFields: string[] | undefined = Array.isArray(parsedPayload._missingFields) ? parsedPayload._missingFields as string[] : undefined;
  const productPublicUrl = typeof parsedPayload.productPublicUrl === 'string' ? parsedPayload.productPublicUrl : null;

  const menuItems: MenuItem[] = [
    {
      label: '属性',
      onClick: () => onOpenPayload(c),
    },
    {
      label: '运行记录',
      disabled: isLoadingThisSteps,
      onClick: () => onOpenSteps(c),
    },
    {
      label: '重命名',
      onClick: () => {
        const newName = window.prompt('新名称', c.title);
        if (newName && newName.trim() && newName.trim() !== c.title) {
          onRename(c, newName.trim());
        }
      },
    },
  ];

  // Add "inspect problem steps" for failed or waiting_human with missing fields
  if (c.status === 'failed' || (c.status === 'waiting_human' && missingFields && missingFields.length > 0)) {
    menuItems.push({
      label: '检查问题步骤',
      disabled: isLoadingThisSteps,
      onClick: () => onOpenSteps(c),
    });
  }

  if (c.status === 'waiting_human') {
    const hasMissing = missingFields && missingFields.length > 0;
    menuItems.push({
      label: hasMissing ? '请先填写必填字段' : '继续执行',
      disabled: isCompleting || !!hasMissing,
      onClick: () => onComplete(c),
    });
  }

  menuItems.push({
    label: '删除',
    variant: 'destructive',
    onClick: () => onDelete(c),
  });

  return (
    <TableRow
      className={cn(
        'cursor-pointer text-[11px] hover:bg-accent/40 transition-colors',
        isSelected && 'bg-primary/5 border-l-2 border-l-primary',
        isChecked && 'bg-primary/5',
      )}
      onClick={() => onNavigate(c.id)}
      data-testid={`case-row-${c.id}`}
    >
      {/* checkbox */}
      <TableCell className="w-8 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="cursor-pointer"
          checked={isChecked}
          onChange={(e) => onToggleSelect(c.id, e.target.checked)}
        />
      </TableCell>

      {/* 案例名称 + progress */}
      <TableCell className="px-2 py-1.5 max-w-[160px]">
        <div className="truncate font-medium text-xs">{c.title}</div>
        <StepProgress workflow={workflow} currentStepId={c.currentStepId} status={c.status} />
        {c.status === 'done' && productPublicUrl && (
          <a
            href={productPublicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-green-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            🛍️ 查看商品
          </a>
        )}
      </TableCell>

      {/* 状态 */}
      <TableCell className="px-2 py-1.5">
        <Badge variant={STATUS_VARIANT[c.status] ?? 'default'} className="text-[9px] uppercase">
          {STATUS_LABEL[c.status] ?? c.status}
        </Badge>
        {missingFields && missingFields.length > 0 && (
          <div className="text-[9px] text-amber-600 mt-0.5 leading-tight">
            需填写: {missingFields.map(fieldLabel).join(', ')}
          </div>
        )}
      </TableCell>

      {/* 当前步骤 */}
      <TableCell className="px-2 py-1.5 text-muted-foreground truncate max-w-[90px]">
        {resolveStepName(c.currentStepId, workflow)}
      </TableCell>

      {/* 创建时间 */}
      <TableCell className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
        {relTime(c.createdAt)}
      </TableCell>

      {/* 操作 */}
      <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          {c.status === 'running' && (
            <div className="h-6 w-6 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            </div>
          )}
          <SimpleMenu
            items={menuItems}
            trigger={<MoreHorizontal className="h-3.5 w-3.5" />}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
