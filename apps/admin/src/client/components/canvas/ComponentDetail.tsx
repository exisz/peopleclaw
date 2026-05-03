/**
 * Component Detail Panel — PLANET-1443: Restructured tabs.
 * Tab structure:
 *   - [运行] (default) — live preview / product view
 *   - [代码] — code viewer (future)
 *   - [流程] — probe timeline + run (BACKEND/FULLSTACK only)
 */
import { useEffect, useRef, useState } from 'react';
import type { RunState, ProbeStep } from './useComponentRun';
import { apiFetch, apiClient } from '../../lib/api';

interface Component {
  id: string;
  name: string;
  type: string;
  runtime?: string;
  isExported?: boolean;
}

// PLANET-1459: Export toggle — lets a component be invoked from other Apps via ctx.callApp
function ExportToggle({ component }: { component: Component }) {
  const [exported, setExported] = useState(!!component.isExported);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setExported(!!component.isExported); }, [component.id, component.isExported]);

  async function toggle() {
    setBusy(true);
    setErr(null);
    const next = !exported;
    try {
      await apiClient.patch(`/api/components/${component.id}/export`, { isExported: next });
      setExported(next);
    } catch (e: any) {
      setErr(e?.message ?? 'failed to update');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 p-3 border border-border rounded" data-testid="component-export-toggle">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={exported}
          onChange={toggle}
          disabled={busy}
          data-testid="component-export-checkbox"
          className="checkbox checkbox-sm"
        />
        <span className="text-sm font-medium">🔗 公开此组件 (允许其他 App 调用)</span>
      </label>
      <p className="text-xs text-muted-foreground mt-1">
        开启后同 tenant 的其他 App 可通过 <code className="bg-muted px-1 rounded">ctx.callApp(appId, '{component.id}', input)</code> 调用.
      </p>
      {err && <p className="text-xs text-error mt-1">{err}</p>}
    </div>
  );
}

type SubTab = 'run' | 'code' | 'flow';

interface Props {
  component: Component;
  runState: RunState;
  onRun: () => void;
  defaultTab?: 'flow' | 'preview';
}

export default function ComponentDetail({ component, runState, onRun, defaultTab }: Props) {
  // Map legacy defaultTab values to new tab names
  const mapTab = (t?: 'flow' | 'preview'): SubTab => t === 'flow' ? 'flow' : 'run';
  const [subTab, setSubTab] = useState<SubTab>(mapTab(defaultTab));

  useEffect(() => {
    setSubTab(mapTab(defaultTab));
  }, [component.id, defaultTab]);

  const hasFlow = component.type === 'BACKEND' || component.type === 'FULLSTACK';

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 text-xs border-b border-border px-4 pt-3 pb-0">
        <button
          data-testid="detail-sub-tab-run"
          onClick={() => setSubTab('run')}
          className={`px-3 py-1.5 rounded-t ${subTab === 'run' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >运行</button>
        <button
          data-testid="detail-sub-tab-code"
          onClick={() => setSubTab('code')}
          className={`px-3 py-1.5 rounded-t ${subTab === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >代码</button>
        {hasFlow && (
          <button
            data-testid="detail-sub-tab-flow"
            onClick={() => setSubTab('flow')}
            className={`px-3 py-1.5 rounded-t ${subTab === 'flow' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >流程</button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {/* 运行 tab — fullscreen preview */}
        {subTab === 'run' && (
          <section className="h-full">
            <FullstackPreview componentId={component.id} componentType={component.type} status={runState.status} />
          </section>
        )}

        {/* 代码 tab */}
        {subTab === 'code' && (
          <section className="p-4">
            <p className="text-xs text-muted-foreground">代码查看器 (coming soon)</p>
            {/* Meta info lives here for now */}
            <div data-testid="detail-meta-name" className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-4">
              <span className="text-muted-foreground">Name</span><span>{component.name}</span>
              <span className="text-muted-foreground">Type</span><span>{component.type}</span>
              <span className="text-muted-foreground">Runtime</span><span>{component.runtime ?? '-'}</span>
              <span className="text-muted-foreground">ID</span><span className="font-mono truncate">{component.id}</span>
            </div>
            <ExportToggle component={component} />
          </section>
        )}

        {/* 流程 tab */}
        {subTab === 'flow' && hasFlow && (
          <section className="p-4 space-y-4">
            <button
              data-testid="detail-run-btn"
              onClick={onRun}
              disabled={runState.status === 'running'}
              className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {runState.status === 'running' ? '运行中...' : '▶ Run'}
            </button>
            <div>
              <h3 className="font-medium text-sm mb-2">探针 Timeline</h3>
              <ProbeTimeline probes={runState.probes} status={runState.status} componentId={component.id} />
            </div>
            {runState.error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2">
                <p className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap">{runState.error}</p>
              </div>
            )}
            {runState.result !== null && runState.result !== undefined && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-sm mb-1">上次结果</summary>
                <pre data-testid="detail-result-json" className="bg-muted p-2 rounded overflow-auto max-h-60 text-[11px]">
                  {JSON.stringify(runState.result, null, 2)}
                </pre>
              </details>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function ProbeTimeline({ probes, status, componentId }: { probes: ProbeStep[]; status: string; componentId: string }) {  const [expectedProbes, setExpectedProbes] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'idle' && probes.length === 0) {
      apiFetch(`/api/components/${componentId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.component?.probes) {
            try {
              const parsed = JSON.parse(d.component.probes);
              setExpectedProbes(parsed.nodes ?? []);
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, [componentId, status, probes.length]);

  if (probes.length === 0) {
    if (expectedProbes.length > 0) {
      return (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground mb-1">预期:</p>
          {expectedProbes.map((node, i) => (
            <div key={i} data-testid={`detail-probe-expected-${node}`} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>○</span>
              <span className="font-mono">{node}</span>
            </div>
          ))}
        </div>
      );
    }
    return <p className="text-xs text-muted-foreground">{status === 'running' ? '等待探针...' : '尚未运行'}</p>;
  }

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

function FullstackPreview({ componentId, componentType, status }: { componentId: string; componentType: string; status: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    setCompileError(null);
    try {
      const compileRes = await apiFetch(`/api/components/${componentId}/compile`, { method: 'POST' });
      if (!compileRes.ok) {
        const err = await compileRes.json().catch(() => ({ error: 'Compile failed' }));
        setCompileError((err as any).error ?? 'Compile failed');
        setLoading(false);
        return;
      }

      const url = `/api/components/${componentId}/client.js?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) {
        setCompileError(`Failed to fetch client bundle: ${res.status}`);
        setLoading(false);
        return;
      }
      let source = await res.text();

      // The client bundle has bare react imports (externalized at compile time).
      // We must provide the host page's React to avoid dual-instance issues.
      // Strategy: create blob shims that re-export from host React, rewrite imports.
      const React = await import('react');
      const ReactDOM = await import('react-dom/client');
      const ReactJSX = await import('react/jsx-runtime');
      (window as any).__PC_REACT__ = React;
      (window as any).__PC_REACT_DOM_CLIENT__ = ReactDOM;
      (window as any).__PC_REACT_JSX__ = ReactJSX;

      const makeShim = (code: string) =>
        URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));

      const reactShim = makeShim(`const R = window.__PC_REACT__; export const { useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer, createElement, Fragment, createContext, forwardRef, memo, lazy, Suspense, startTransition, useId, useSyncExternalStore, useTransition, useDeferredValue, useImperativeHandle, useLayoutEffect, useDebugValue, useInsertionEffect } = R; export default R;`);
      const jsxShim = makeShim(`const J = window.__PC_REACT_JSX__; export const { jsx, jsxs, Fragment } = J; export default J;`);
      const domShim = makeShim(`const D = window.__PC_REACT_DOM_CLIENT__; export const { createRoot, hydrateRoot } = D; export default D;`);

      // Rewrite bare specifier imports to blob shim URLs
      source = source.replace(/from\s*["']react\/jsx-runtime["']/g, `from "${jsxShim}"`);
      source = source.replace(/from\s*["']react\/jsx-dev-runtime["']/g, `from "${jsxShim}"`);
      source = source.replace(/from\s*["']react-dom\/client["']/g, `from "${domShim}"`);
      source = source.replace(/from\s*["']react-dom["']/g, `from "${domShim}"`);
      source = source.replace(/from\s*["']react["']/g, `from "${reactShim}"`);

      const blobUrl = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
      const mod = await import(/* @vite-ignore */ blobUrl);
      URL.revokeObjectURL(blobUrl);
      URL.revokeObjectURL(reactShim);
      URL.revokeObjectURL(jsxShim);
      URL.revokeObjectURL(domShim);

      const Client = mod.default ?? mod.Client;
      if (!Client) {
        setCompileError('No Client export found in bundle');
        setLoading(false);
        return;
      }

      // PLANET-1555: if this is a FULLSTACK component, hit /server first so
      // Client receives real `data`. Skip for FRONTEND — no server handler
      // and the 400 would show up as a console error (PLANET-1432).
      let serverData: any = null;
      if (componentType === 'FULLSTACK') {
        try {
          const srvRes = await apiFetch(`/api/components/${componentId}/server`);
          if (srvRes.ok) {
            serverData = await srvRes.json().catch(() => null);
          }
        } catch {}
      }

      // Fetch outgoing TRIGGER connections to wire onSubmit → backend run
      let triggerTargetId: string | null = null;
      try {
        const connRes = await apiFetch(`/api/components/${componentId}/connections`);
        if (connRes.ok) {
          const connData = await connRes.json();
          const trigger = (connData.connections ?? []).find((c: any) => c.type === 'TRIGGER' && c.fromComponentId === componentId);
          if (trigger) triggerTargetId = trigger.toComponentId;
        }
      } catch {}

      const onSubmit = triggerTargetId
        ? async (data: any) => {
            const runRes = await apiFetch(`/api/components/${triggerTargetId}/run`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            if (!runRes.ok) throw new Error('Backend run failed');
            // Parse SSE response to extract result.
            // Wire format (createSSEStream): blocks separated by \n\n,
            //   event: <name>\ndata: <json>
            // We want the payload of the `result` event.
            const text = await runRes.text();
            const blocks = text.split(/\n\n+/);
            for (const block of blocks) {
              const lines = block.split('\n');
              let eventName: string | null = null;
              let dataStr: string | null = null;
              for (const line of lines) {
                if (line.startsWith('event: ')) eventName = line.slice(7).trim();
                else if (line.startsWith('data: ')) dataStr = line.slice(6);
              }
              if (eventName === 'result' && dataStr) {
                try { return JSON.parse(dataStr); } catch { return null; }
              }
            }
            return null;
          }
        : undefined;

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        const root = ReactDOM.createRoot(containerRef.current);
        root.render(React.createElement(Client, {
          data: serverData,
          refresh: () => loadPreview(),
          onSubmit,
        }));
        setMounted(true);
      }
    } catch (err: any) {
      setCompileError(err.message ?? 'Failed to load preview');
    }
    setLoading(false);
  };

  useEffect(() => {
    // Auto-load preview when entering preview tab
    if (!mounted && !loading) {
      loadPreview();
    }
  }, [componentId]);

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
