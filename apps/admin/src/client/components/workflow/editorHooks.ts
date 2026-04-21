import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workflow } from '../../types';
import { apiClient } from '../../lib/api';
import { toast } from 'sonner';

export type SaveState = 'saved' | 'saving' | 'dirty';

function dehydrate(w: Workflow): Record<string, unknown> {
  return {
    description: w.description,
    icon: w.icon,
    steps: w.steps,
    nodes: w.steps.map((s) => ({
      id: s.id,
      position: s.position ?? { x: 0, y: 0 },
    })),
    edges: [],
  };
}

export function useDebouncedSave(
  workflow: Workflow | null,
  intervalMs = 800,
  onSaved?: () => void,
) {
  const [state, setState] = useState<SaveState>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Workflow | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; });

  const doSave = useCallback(async (wf: Workflow) => {
    setState('saving');
    try {
      await apiClient.put(`/api/workflows/${wf.id}`, {
        name: wf.name,
        category: wf.category,
        definition: dehydrate(wf),
      });
      if (!timer.current && !pending.current) {
        setState('saved');
        toast.success('工作流已保存', { description: wf.name, duration: 2000 });
        onSavedRef.current?.();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Save failed', { description: msg });
      setState('dirty');
    }
  }, []);

  const schedule = useCallback(
    (wf: Workflow) => {
      pending.current = wf;
      setState('dirty');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const w = pending.current;
        pending.current = null;
        if (!w) return;
        inFlight.current = (inFlight.current ?? Promise.resolve()).then(() => doSave(w));
      }, intervalMs);
    },
    [doSave, intervalMs],
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const w = pending.current;
    pending.current = null;
    if (w) {
      inFlight.current = (inFlight.current ?? Promise.resolve()).then(() => doSave(w));
    }
  }, [doSave]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (workflow?.id) setState('saved');
  }, [workflow?.id]);

  return { state, schedule, flush };
}

export function useUndoStack<T>(initial: T, max = 50) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const current = useRef<T>(initial);

  const reset = useCallback((v: T) => {
    past.current = [];
    future.current = [];
    current.current = v;
  }, []);

  const push = useCallback(
    (next: T) => {
      past.current.push(current.current);
      if (past.current.length > max) past.current.shift();
      future.current = [];
      current.current = next;
    },
    [max],
  );

  const undo = useCallback((): T | null => {
    const prev = past.current.pop();
    if (prev === undefined) return null;
    future.current.push(current.current);
    current.current = prev;
    return prev;
  }, []);

  const redo = useCallback((): T | null => {
    const nxt = future.current.pop();
    if (nxt === undefined) return null;
    past.current.push(current.current);
    current.current = nxt;
    return nxt;
  }, []);

  const sizes = () => ({ past: past.current.length, future: future.current.length });

  return { push, undo, redo, reset, sizes };
}

export function loadLayout(workflowId: string, fallback: number[]): number[] {
  try {
    const raw = localStorage.getItem(`peopleclaw-layout-${workflowId}`);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    if (Array.isArray(v) && v.every((n) => typeof n === 'number')) return v;
  } catch {
    /* */
  }
  return fallback;
}

export function saveLayout(workflowId: string, sizes: number[]): void {
  try {
    localStorage.setItem(`peopleclaw-layout-${workflowId}`, JSON.stringify(sizes));
  } catch {
    /* */
  }
}
