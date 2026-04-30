/**
 * PLANET-1385: Template library dialog — creates workflow then pushes a flow Block to canvas.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, LibraryBig } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { apiClient } from '../lib/api';
import { useCanvas } from './CanvasContext';
import { CanvasFlowView } from './replit/CanvasFlowView';
import type { Block } from './replit/canvasElements';
import { addStoredBlock } from './replit/canvasElements';

interface TemplateStep {
  name: string;
}

interface Template {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  stepCount: number;
  steps: TemplateStep[];
}

interface TemplateLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TemplateLibraryDialog({ open, onOpenChange }: TemplateLibraryDialogProps) {
  const { setCanvas } = useCanvas();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient.get('/api/templates')
      .then((data: unknown) => {
        const d = data as { templates: Template[] };
        setTemplates(d.templates ?? []);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`加载模板失败: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleUse = async (t: Template) => {
    setUsingId(t.id);
    try {
      const data = await apiClient.post(`/api/templates/${t.id}/use`, {}) as { workflow: { id: string; name: string } };
      toast.success(`已创建工作流「${data.workflow.name}」`);

      // Create a flow block and push to canvas
      const block: Block = {
        id: `wf-${data.workflow.id}`,
        name: data.workflow.name,
        type: 'flow',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workflowId: data.workflow.id,
        input: { schema: {} },
        output: { schema: {} },
      };
      addStoredBlock(block);
      setCanvas(<CanvasFlowView block={block} />, block.name);

      setUsingId(null);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`一键使用失败: ${msg}`);
      setUsingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LibraryBig className="h-5 w-5" /> 模板库
          </DialogTitle>
          <DialogDescription>
            选择一个模板，一键创建工作流，快速上手。
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
          </div>
        )}

        {!loading && templates.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">暂无模板。</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.category && (
                    <Badge variant="secondary" className="text-xs shrink-0">{t.category}</Badge>
                  )}
                </div>
                {t.description && (
                  <CardDescription className="text-xs">{t.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t.stepCount} 步
                  </p>
                  <ul className="space-y-0.5">
                    {t.steps.map((s, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-primary/60 shrink-0" />
                        {s.name}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto pt-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleUse(t)}
                    disabled={usingId !== null}
                    data-testid={`use-template-${t.id}`}
                  >
                    {usingId === t.id ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 创建中…</>
                    ) : (
                      '一键使用'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
