/**
 * PLANET-1196 — BatchImportDialog
 * Upload .xlsx / .csv → fan-out N cases via POST /api/batch-import
 */
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface BatchImportResult {
  batchId: string;
  workflowId: string;
  ok_count: number;
  error_count: number;
  unmapped_columns: string[];
  cases: Array<{ id: string; status: string; row: number }>;
}

interface BatchImportDialogProps {
  open: boolean;
  onClose: () => void;
  workflowId: string; // pass 'auto' to let server auto-compose
  onSuccess: (result: BatchImportResult) => void;
}

export default function BatchImportDialog({
  open, onClose, workflowId, onSuccess,
}: BatchImportDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<BatchImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|csv)$/i)) {
      toast.error('仅支持 .xlsx 或 .csv 文件');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('文件不能超过 1MB');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('workflowId', workflowId);
      const data = await apiClient.postForm<BatchImportResult>('/api/batch-import', form);
      setResult(data);
      onSuccess(data);
      toast.success(`批次导入成功：${data.ok_count} 行正常，${data.error_count} 行待修复`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('导入失败', { description: msg });
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setResult(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            批量导入商品表
          </DialogTitle>
          <DialogDescription>
            上传 .xlsx 或 .csv 文件（最多 10 行商品数据），系统自动解析并创建对应案例。
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
            `}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleInputChange}
            />
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            {uploading ? (
              <p className="text-sm text-muted-foreground">正在解析并创建案例…</p>
            ) : (
              <>
                <p className="text-sm font-medium">拖拽文件到此处，或点击选择</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx / .csv，最大 1MB，最多 10 行</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.ok_count}</p>
                <p className="text-xs text-green-600 dark:text-green-400">行已创建案例</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${result.error_count > 0 ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' : 'bg-muted border-border'}`}>
                <AlertCircle className={`h-5 w-5 mx-auto mb-1 ${result.error_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
                <p className={`text-2xl font-bold ${result.error_count > 0 ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>{result.error_count}</p>
                <p className={`text-xs ${result.error_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>行待修复</p>
              </div>
            </div>

            {result.unmapped_columns.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">未识别列（已忽略）：</p>
                <div className="flex flex-wrap gap-1">
                  {result.unmapped_columns.map((col) => (
                    <Badge key={col} variant="outline" className="text-[10px]">{col}</Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              批次 ID: <span className="font-mono">{result.batchId}</span>
            </p>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setResult(null)}>
                再导入一次
              </Button>
              <Button size="sm" className="flex-1" onClick={() => { setResult(null); onClose(); }}>
                关闭
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
