import { Button } from '../../ui/button';

interface CaseBatchBarProps {
  selectedCount: number;
  onBatchContinue: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export function CaseBatchBar({
  selectedCount,
  onBatchContinue,
  onBatchDelete,
  onClearSelection,
}: CaseBatchBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b text-xs">
      <span className="font-medium">已选 {selectedCount} 个案例</span>
      <Button size="sm" variant="outline" className="h-6 text-xs" onClick={onBatchContinue}>
        ▶️ 批量继续
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-xs text-destructive"
        onClick={onBatchDelete}
      >
        🗑️ 批量删除
      </Button>
      <div className="ml-auto">
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onClearSelection}>
          取消选择
        </Button>
      </div>
    </div>
  );
}
