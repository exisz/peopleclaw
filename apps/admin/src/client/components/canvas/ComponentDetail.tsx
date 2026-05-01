/**
 * Component Detail Panel — meta info + probe timeline + fullstack preview
 * (PLANET-1421)
 */
import { useEffect, useRef, useState } from 'react';
import type { RunState, ProbeStep } from './useComponentRun';
import { apiFetch } from '../../lib/api';

interface Component {
  id: string;
  name: string;
  type: string;
  runtime?: string;
}

interface Props {
  component: Component;
  runState: RunState;
  onRun: () => void;
}

export default function ComponentDetail({ component, runState, onRun }: Props) {
  return (
    <div className="p-4 overflow-auto h-full space-y-4">
      {/* Meta */}
      <section>
        <h3 className="font-medium text-sm mb-2">组件信息</h3>
        <div data-testid="detail-meta-name" className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">Name</span><span>{component.name}</span>
          <span className="text-muted-foreground">Type</span><span>{component.type}</span>
          <span className="text-muted-foreground">Runtime</span><span>{component.runtime ?? '-'}</span>
          <span className="text-muted-foreground">ID</span><span className="font-mono truncate">{component.id}</span>
        </div>
        <button disabled className="mt-2 text-xs px-2 py-1 rounded border border-border text-muted-foreground opacity-50 cursor-not-allowed">
          编辑代码
        </button>
      </section>

      {/* Run button */}
      {component.type !== 'FRONTEND' && (
        <button
          onClick={onRun}
          disabled={runState.status === 'running'}
          className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {runState.status === 'running' ? '运行中...' : '▶ Run'}
        </button>
      )}

      {/* Probe Timeline */}
      <section>
        <h3 className="font-medium text-sm mb-2">探针 Timeline</h3>
        <ProbeTimeline probes={runState.probes} status={runState.status} />
      </section>

      {/* Result / Error */}
      {runState.error && (
        <section className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2">
          <p className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap">{runState.error}</p>
        </section>
      )}
      {runState.result !== null && runState.result !== undefined && (
        <section>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-sm mb-1">上次结果</summary>
            <pre data-testid="detail-result-json" className="bg-muted p-2 rounded overflow-auto max-h-60 text-[11px]">
              {JSON.stringify(runState.result, null, 2)}
            </pre>
          </details>
        </section>
      )}

      {/* Fullstack Preview */}
      {component.type === 'FULLSTACK' && (
        <section>
          <h3 className="font-medium text-sm mb-2">预览</h3>
          <FullstackPreview componentId={component.id} status={runState.status} />
        </section>
      )}
    </div>
  );
}

function ProbeTimeline({ probes, status }: { probes: ProbeStep[]; status: string }) {
  if (probes.length === 0) {
    return <p className="text-xs text-muted-foreground">{status === 'running' ? '等待探针...' : '尚未运行'}</p>;
  }

  // Group enter/exit pairs
  const steps: { node: string; duration_ms?: number; phase: 'enter' | 'exit' }[] = [];
  for (const p of probes) {
    if (p.phase === 'exit') {
      steps.push({ node: p.node, duration_ms: p.duration_ms, phase: 'exit' });
    } else if (p.phase === 'enter' && !steps.find(s => s.node === p.node)) {
      steps.push({ node: p.node, phase: 'enter' });
    }
  }

  // Merge: prefer exit (has duration)
  const merged = new Map<string, { node: string; duration_ms?: number; done: boolean }>();
  for (const p of probes) {
    if (p.phase === 'exit') {
      merged.set(p.node, { node: p.node, duration_ms: p.duration_ms, done: true });
    } else if (!merged.has(p.node)) {
      merged.set(p.node, { node: p.node, done: false });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {[...merged.values()].map((step, i) => (
        <div key={i} data-testid={`detail-probe-step-${step.node}`} className="flex items-center gap-2 text-xs">
          <span className={step.done ? 'text-green-600' : 'text-yellow-600'}>
            {step.done ? '✓' : '⏳'}
          </span>
          <span className="font-mono">{step.node}</span>
          {step.duration_ms !== undefined && (
            <span className="text-muted-foreground">({step.duration_ms}ms)</span>
          )}
        </div>
      ))}
    </div>
  );
}

function FullstackPreview({ componentId, status }: { componentId: string; status: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    setCompileError(null);
    try {
      // Compile first
      const compileRes = await apiFetch(`/api/components/${componentId}/compile`, { method: 'POST' });
      if (!compileRes.ok) {
        const err = await compileRes.json().catch(() => ({ error: 'Compile failed' }));
        setCompileError((err as any).error ?? 'Compile failed');
        setLoading(false);
        return;
      }

      // Dynamic import client bundle
      const url = `/api/components/${componentId}/client.js?t=${Date.now()}`;
      const mod = await import(/* @vite-ignore */ url);
      const Client = mod.default ?? mod.Client;
      if (!Client) {
        setCompileError('No Client export found in bundle');
        setLoading(false);
        return;
      }

      // Mount React component
      if (containerRef.current) {
        const ReactDOM = await import('react-dom/client');
        const React = await import('react');
        containerRef.current.innerHTML = '';
        const root = ReactDOM.createRoot(containerRef.current);
        root.render(React.createElement(Client, {
          data: null,
          refresh: () => loadPreview(),
        }));
        setMounted(true);
      }
    } catch (err: any) {
      setCompileError(err.message ?? 'Failed to load preview');
    }
    setLoading(false);
  };

  useEffect(() => {
    // Auto-load when status becomes done or on first render if already done
    if (status === 'done' && !mounted) {
      loadPreview();
    }
  }, [status]);

  return (
    <div>
      {!mounted && !loading && (
        <button
          onClick={loadPreview}
          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
        >
          加载预览
        </button>
      )}
      {loading && <p className="text-xs text-muted-foreground">编译加载中...</p>}
      {compileError && <p className="text-xs text-red-600">{compileError}</p>}
      <div ref={containerRef} data-testid="detail-fullstack-preview" className="mt-2 border border-border rounded p-2 min-h-[100px]" />
    </div>
  );
}
