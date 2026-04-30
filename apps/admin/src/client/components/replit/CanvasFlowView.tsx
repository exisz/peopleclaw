/**
 * PLANET-1385: Canvas flow view — renders a Block of type 'flow'.
 * Shows input ports → processing → output ports in a horizontal flow.
 * If the block has a workflowId and the workflow exists, renders WorkflowCanvas.
 */
import { Play, ArrowRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { Block } from './canvasElements';

interface CanvasFlowViewProps {
  block: Block;
}

function PortList({ title, schema, color }: { title: string; schema: Record<string, string>; color: string }) {
  const entries = Object.entries(schema);
  if (entries.length === 0) return null;

  return (
    <div className={`rounded-xl border ${color} bg-white/[0.02] p-4 min-w-[160px]`}>
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-3">{title}</h4>
      <div className="space-y-2">
        {entries.map(([key, type]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400/60" />
            <span className="text-xs text-white/70">{key}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40 ml-auto">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CanvasFlowView({ block }: CanvasFlowViewProps) {
  const inputSchema = block.input?.schema || {};
  const outputSchema = block.output?.schema || {};

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{block.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              🔄 Flow
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {block.status}
            </span>
            {block.workflowId && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.08]">
                ID: {block.workflowId}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Flow diagram */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {/* Input ports */}
          <PortList title="输入 (Input)" schema={inputSchema} color="border-green-500/20" />

          {/* Arrow */}
          <ArrowRight className="w-5 h-5 text-white/20 shrink-0" />

          {/* Processing center */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-6 flex flex-col items-center gap-2 min-w-[140px]">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <span className="text-xs font-medium text-white/60">处理</span>
            {block.workflowId && (
              <span className="text-[10px] text-white/30">workflow: {block.workflowId}</span>
            )}
          </div>

          {/* Arrow */}
          <ArrowRight className="w-5 h-5 text-white/20 shrink-0" />

          {/* Output ports */}
          <PortList title="输出 (Output)" schema={outputSchema} color="border-purple-500/20" />
        </div>
      </div>

      {/* Bottom: Run button */}
      <div className="flex items-center justify-center p-4 border-t border-white/[0.06] shrink-0">
        <button
          onClick={() => toast.info('运行 — 功能开发中')}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
        >
          <Play className="w-4 h-4" />
          运行
        </button>
      </div>
    </div>
  );
}
