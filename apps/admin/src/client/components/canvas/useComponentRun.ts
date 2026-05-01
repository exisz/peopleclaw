/**
 * Hook: consume SSE from POST /api/components/:id/run
 * Returns probe timeline, result, error, and status.
 * (PLANET-1421)
 */
import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '../../lib/api';

export type ComponentStatus = 'idle' | 'running' | 'done' | 'error';

export interface ProbeStep {
  node: string;
  phase: 'enter' | 'exit';
  ts: number;
  duration_ms?: number;
}

export interface RunState {
  status: ComponentStatus;
  probes: ProbeStep[];
  result: unknown | null;
  error: string | null;
}

const initialState: RunState = { status: 'idle', probes: [], result: null, error: null };

export function useComponentRun() {
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const abortRefs = useRef<Record<string, AbortController>>({});

  const getState = useCallback((id: string): RunState => runs[id] ?? initialState, [runs]);

  const runComponent = useCallback(async (id: string) => {
    // Abort previous if still running
    abortRefs.current[id]?.abort();
    const ctrl = new AbortController();
    abortRefs.current[id] = ctrl;

    setRuns(prev => ({ ...prev, [id]: { status: 'running', probes: [], result: null, error: null } }));

    try {
      const res = await apiFetch(`/api/components/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        setRuns(prev => ({ ...prev, [id]: { ...prev[id], status: 'error', error: text } }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (eventType === 'probe') {
              setRuns(prev => {
                const cur = prev[id] ?? initialState;
                return { ...prev, [id]: { ...cur, probes: [...cur.probes, data as ProbeStep] } };
              });
            } else if (eventType === 'result') {
              setRuns(prev => ({ ...prev, [id]: { ...prev[id], status: 'done', result: data } }));
            } else if (eventType === 'error') {
              setRuns(prev => ({ ...prev, [id]: { ...prev[id], status: 'error', error: data.message ?? 'Unknown error' } }));
            }
          }
        }
      }

      // If we finished reading without result/error, mark done
      setRuns(prev => {
        const cur = prev[id];
        if (cur && cur.status === 'running') return { ...prev, [id]: { ...cur, status: 'done' } };
        return prev;
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setRuns(prev => ({ ...prev, [id]: { ...(prev[id] ?? initialState), status: 'error', error: err.message } }));
    }
  }, []);

  return { getState, runComponent, runs };
}
