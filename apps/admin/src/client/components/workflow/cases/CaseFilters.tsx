import { useTranslation } from 'react-i18next';
import type { FilterKey } from './types';
import { FILTERS } from './types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '../../../lib/utils';
import { Plus, Upload, Play, Loader2 } from 'lucide-react';

interface CaseFiltersProps {
  newTitle: string;
  setNewTitle: (v: string) => void;
  creating: boolean;
  onCreateCase: () => void;
  onBatchImport: () => void;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  runningSelected: boolean;
  onRunSelected: () => void;
  stepsCount: number;
}

export function CaseFilters({
  newTitle,
  setNewTitle,
  creating,
  onCreateCase,
  onBatchImport,
  filter,
  setFilter,
  runningSelected,
  onRunSelected,
  stepsCount,
}: CaseFiltersProps) {
  const { t } = useTranslation('workflow');

  return (
    <div className="px-3 py-2.5 border-b space-y-2">
      {/* Row 1: New case input + Run button */}
      <div className="flex gap-1.5">
        <Input
          placeholder={t('cases.newCasePlaceholder', { defaultValue: '案例标题' })}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCreateCase(); }}
          className="h-7 text-xs flex-1"
          data-testid="cases-new-title"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs shrink-0"
          onClick={onCreateCase}
          disabled={creating || !newTitle.trim()}
          data-testid="cases-new-submit"
        >
          <Plus className="h-3 w-3 mr-0.5" />
          新建
        </Button>
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
          onClick={onRunSelected}
          disabled={runningSelected || stepsCount === 0}
          data-testid="run-workflow-button"
          title="运行选中的待审核案例"
        >
          {runningSelected ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          <span>{runningSelected ? '运行中…' : '▶ 运行'}</span>
        </Button>
      </div>

      {/* Row 2: Batch import */}
      <Button
        size="sm"
        variant="outline"
        className="w-full h-6 text-[10px] gap-1.5 border-dashed"
        onClick={onBatchImport}
        data-testid="cases-batch-import-btn"
      >
        <Upload className="h-3 w-3" />
        批量导入 Excel / CSV
      </Button>

      {/* Row 3: Filters */}
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            data-testid={`cases-filter-${f.key}`}
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border',
              filter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {t(`cases.filter.${f.key}`, { defaultValue: f.label })}
          </button>
        ))}
      </div>
    </div>
  );
}
