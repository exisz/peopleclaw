import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import type { Workflow, WorkflowStep } from '../../types';
import Canvas, { autoLayout } from './Canvas';
import PropertiesPanel from './PropertiesPanel';
import CasesPanel from './CasesPanel';
import RunsPanel from './RunsPanel';
import ShortcutHelp from './ShortcutHelp';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Check, Loader2, CircleDot, HelpCircle, Undo2, Redo2, PlayCircle, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDebouncedSave, useUndoStack, loadLayout, saveLayout } from './editorHooks';
import type { StepTemplate } from './Sidebar';
import { apiClient } from '../../lib/api';

function newStepId(): string {
  return `s_${nanoid(6)}`;
}

function templateToStep(tpl: StepTemplate, position: { x: number; y: number }): WorkflowStep {
  const labelEn = tpl.label?.en ?? tpl.id;
  const uiType: WorkflowStep['type'] =
    tpl.kind === 'human' ? 'human' : tpl.kind === 'subflow' ? 'subflow' : 'agent';
  return {
    id: newStepId(),
    name: labelEn,
    type: uiType,
    assignee: tpl.handler,
    description: tpl.description?.en ?? '',
    tools: [`handler:${tpl.handler}`],
    position,
    iconName: tpl.icon,
    templateId: tpl.id,
    fromTemplate: true,
  };
}

function SaveIndicator({ state }: { state: 'saved' | 'saving' | 'dirty' }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border',
        state === 'saved' && 'border-border text-muted-foreground bg-background',
        state === 'saving' && 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/5',
        state === 'dirty' && 'border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/5',
      )}
      data-testid={`save-indicator-${state}`}
    >
      {state === 'saved' && <Check className="h-3 w-3" />}
      {state === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === 'dirty' && <CircleDot className="h-3 w-3" />}
      <span>{state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Unsaved'}</span>
    </div>
  );
}

interface CaseDetail {
  id: string;
  status: string;
  currentStepId: string | null;
  stepModeOverrides?: string; // PLANET-1251
  steps?: Array<{ id: string; stepId: string; status: string; error: string | null }>;
}

// PLANET-1069: workflow run state
type RunStatus = 'idle' | 'running' | 'done' | 'error';
interface StepRunResult {
  stepId: string;
  stepType: string;
  status: 'success' | 'error';
  output: Record<string, unknown>;
  error?: string;
  durationMs: number;
}
interface RunState {
  status: RunStatus;
  runId: string | null;
  stepStatuses: Record<string, string>; // stepId → 'pending'|'running'|'done'|'failed'
  stepResults: StepRunResult[];
  shopifyProductUrl: string | null;
  error: string | null;
}

function EditorInner({
  workflow,
  selectedCaseId,
  templates,
  onSaved,
}: {
  workflow: Workflow;
  selectedCaseId: string | null;
  templates: StepTemplate[];
  onSaved?: () => void;
}) {
  const { t } = useTranslation('workflow');
  const navigate = useNavigate();
  const rf = useReactFlow();

  const [steps, setSteps] = useState<WorkflowStep[]>(() => autoLayout(workflow.steps));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'cases' | 'runs'>('properties');
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);

  // PLANET-1069: run state
  const [runState, setRunState] = useState<RunState>({
    status: 'idle',
    runId: null,
    stepStatuses: {},
    stepResults: [],
    shopifyProductUrl: null,
    error: null,
  });
  const sseRef = useRef<EventSource | null>(null);

  // Cleanup SSE on unmount
  useEffect(() => () => { sseRef.current?.close(); }, []);

  // Undo stack on steps[]
  const undo = useUndoStack<WorkflowStep[]>(steps, 50);
  const { state: saveState, schedule, flush } = useDebouncedSave(workflow, 800, onSaved);

  // PLANET-1069: run handlers (after flush is declared)
  // PLANET-1122: helper — merge all known step ids to done/failed, using prev.stepStatuses
  // as source-of-truth for 'failed', filling any missing keys with 'done'.
  // Uses BOTH workflow.steps (prop) and prev.stepStatuses (event-tracked) so stale closures
  // never leave a step without an explicit final status.
  const handleSseEvent = useCallback((event: string, data: Record<string, unknown>) => {
    console.log('[SSE event]', event, data); // PLANET-1122 debug — remove next ticket
    switch (event) {
      case 'step:start':
        setRunState(prev => {
          const next = { ...prev.stepStatuses, [data.stepId as string]: 'running' };
          console.log('[stepStatuses after step:start]', next); // PLANET-1122 debug
          return { ...prev, stepStatuses: next };
        });
        break;
      case 'step:done': {
        const stepId = data.stepId as string;
        const success = data.status === 'success';
        setRunState(prev => {
          const next = { ...prev.stepStatuses, [stepId]: success ? 'done' : 'failed' };
          console.log('[stepStatuses after step:done]', next); // PLANET-1122 debug
          return { ...prev, stepStatuses: next, stepResults: [...prev.stepResults, data as unknown as StepRunResult] };
        });
        break;
      }
      case 'run:complete':
        setRunState(prev => {
          // PLANET-1122: build final statuses covering ALL known step ids —
          // (a) start with every step in workflow.steps (prop)
          // (b) also cover any step id already tracked in prev.stepStatuses (SSE events)
          // This handles stale-closure mismatches between prop and editor state.
          const allIds = new Set<string>([
            ...workflow.steps.map(s => s.id),
            ...Object.keys(prev.stepStatuses),
          ]);
          const finalStatuses = Object.fromEntries(
            [...allIds].map(id => [id, prev.stepStatuses[id] === 'failed' ? 'failed' : 'done'])
          );
          console.log('[stepStatuses after run:complete]', finalStatuses); // PLANET-1122 debug
          return {
            ...prev,
            status: 'done',
            shopifyProductUrl: (data.shopifyProductUrl as string) ?? null,
            stepResults: (data.steps as StepRunResult[]) ?? prev.stepResults,
            stepStatuses: finalStatuses,
          };
        });
        toast.success('工作流执行完成 🎉');
        break;
      case 'run:error':
        setRunState(prev => {
          const next = { ...prev.stepStatuses, [data.failedStep as string]: 'failed' };
          console.log('[stepStatuses after run:error]', next); // PLANET-1122 debug
          return {
            ...prev,
            status: 'error',
            error: data.error as string,
            stepResults: (data.steps as StepRunResult[]) ?? prev.stepResults,
            stepStatuses: next,
          };
        });
        toast.error('节点执行失败', { description: data.error as string });
        break;
      case 'end':
        // Sentinel: if run:complete was already received this is a no-op; otherwise treat as done
        setRunState(prev => {
          if (prev.status !== 'running') return prev;
          // PLANET-1122: same all-ids strategy as run:complete
          const allIds = new Set<string>([
            ...workflow.steps.map(s => s.id),
            ...Object.keys(prev.stepStatuses),
          ]);
          const finalStatuses = Object.fromEntries(
            [...allIds].map(id => [id, prev.stepStatuses[id] === 'failed' ? 'failed' : 'done'])
          );
          console.log('[stepStatuses after end sentinel]', finalStatuses); // PLANET-1122 debug
          return { ...prev, status: 'done', stepStatuses: finalStatuses };
        });
        break;
    }
  }, [workflow.steps]);

  const handleRun = useCallback(async () => {
    if (runState.status === 'running') return;
    // Flush unsaved changes first
    flush();
    // PLANET-1122: initialize ALL steps to 'pending' so run:complete overlay always covers every node
    const initialStatuses = Object.fromEntries(steps.map(s => [s.id, 'pending']));
    setRunState({ status: 'running', runId: null, stepStatuses: initialStatuses, stepResults: [], shopifyProductUrl: null, error: null });
    // Clear previous case detail so old 'done' statuses don't bleed into the new run's color overlay
    setCaseDetail(null);
    setActiveTab('runs');

    // Close any existing SSE
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }

    // Track whether we received a terminal event
    let receivedTerminalEvent = false;

    // SSE via fetch (to include auth headers)
    try {
      const response = await apiClient.postRaw(`/api/workflows/${workflow.id}/run`, { payload: {} });
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          // Flush any remaining buffered data when stream closes
          if (done) {
            if (buffer.trim()) {
              const lines = (buffer + '\n').split('\n');
              let currentEvent = '';
              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                  try {
                    const eventData = JSON.parse(line.slice(6)) as Record<string, unknown>;
                    if (currentEvent === 'run:complete' || currentEvent === 'run:error') receivedTerminalEvent = true;
                    handleSseEvent(currentEvent, eventData);
                  } catch { /* ignore parse errors on flush */ }
                  currentEvent = '';
                }
              }
            }
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const eventData = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (currentEvent === 'run:complete' || currentEvent === 'run:error') receivedTerminalEvent = true;
              handleSseEvent(currentEvent, eventData);
              currentEvent = '';
            }
          }
        }
      };
      await processStream();
      // If stream ended without run:complete or run:error, treat as done (all steps succeeded)
      if (!receivedTerminalEvent) {
        setRunState(prev => ({
          ...prev,
          status: prev.status === 'running' ? 'done' : prev.status,
        }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRunState(prev => ({ ...prev, status: 'error', error: msg }));
      toast.error('运行失败', { description: msg });
    } finally {
      // Ensure we never leave status as 'running' indefinitely
      setRunState(prev => prev.status === 'running' ? { ...prev, status: 'done', error: null } : prev);
    }
  }, [runState.status, workflow.id, flush, handleSseEvent, steps]);

  // When workflow id changes, reset
  useEffect(() => {
    const next = autoLayout(workflow.steps);
    setSteps(next);
    setSelectedIds([]);
    undo.reset(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  // Fetch case detail when selectedCaseId set
  useEffect(() => {
    if (!selectedCaseId) {
      setCaseDetail(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const { case: c } = await apiClient.get<{ case: CaseDetail }>(`/api/cases/${selectedCaseId}`);
        if (!cancelled) setCaseDetail(c);
      } catch {
        /* */
      } finally {
        if (!cancelled) timer = setTimeout(tick, 5000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedCaseId]);

  // commitSteps: update local + push to undo + schedule debounced save
  const commitSteps = useCallback(
    (next: WorkflowStep[], opts?: { skipUndo?: boolean; skipSave?: boolean }) => {
      setSteps(next);
      if (!opts?.skipUndo) undo.push(next);
      if (!opts?.skipSave) schedule({ ...workflow, steps: next });
    },
    [undo, schedule, workflow],
  );

  // Position changes from drag-end (don't push undo every micro-move; push once per commit)
  const handlePositionsChange = useCallback(
    (updates: Array<{ id: string; position: { x: number; y: number } }>) => {
      const map = new Map(updates.map((u) => [u.id, u.position]));
      const next = steps.map((s) => (map.has(s.id) ? { ...s, position: map.get(s.id)! } : s));
      commitSteps(next);
    },
    [steps, commitSteps],
  );

  const handleDropTemplate = useCallback(
    (raw: unknown, position: { x: number; y: number }) => {
      const data = raw as { type?: string; templateId?: string; template?: StepTemplate; node?: WorkflowStep };
      if (data?.type === 'peopleclaw.step-template' && data.template) {
        const newStep = templateToStep(data.template, position);
        // Auto-connect from currently selected node — implicit via index ordering: insert after selected
        let next: WorkflowStep[];
        if (selectedIds.length === 1) {
          const idx = steps.findIndex((s) => s.id === selectedIds[0]);
          if (idx >= 0) {
            next = [...steps.slice(0, idx + 1), newStep, ...steps.slice(idx + 1)];
          } else {
            next = [...steps, newStep];
          }
        } else {
          next = [...steps, newStep];
        }
        commitSteps(next);
        setSelectedIds([newStep.id]);
        toast.success(`Added: ${newStep.name}`);
      } else if (data?.type === 'peopleclaw.node' && data.node) {
        // Paste from clipboard data
        const cloned: WorkflowStep = { ...data.node, id: newStepId(), position };
        commitSteps([...steps, cloned]);
        setSelectedIds([cloned.id]);
      }
    },
    [steps, selectedIds, commitSteps],
  );

  const deleteStepsWithUndo = useCallback(
    (ids: string[]) => {
      const removed = steps.filter((s) => ids.includes(s.id));
      const next = steps.filter((s) => !ids.includes(s.id));
      commitSteps(next);
      setSelectedIds([]);
      toast(`Deleted ${removed.length} node${removed.length === 1 ? '' : 's'}`, {
        action: {
          label: 'Undo',
          onClick: () => commitSteps([...next, ...removed]),
        },
        duration: 5000,
      });
    },
    [steps, commitSteps],
  );

  const duplicateSteps = useCallback(
    (ids: string[], offset = { x: 40, y: 40 }) => {
      const sources = steps.filter((s) => ids.includes(s.id));
      if (sources.length === 0) return;
      const clones = sources.map((s) => ({
        ...s,
        id: newStepId(),
        position: {
          x: (s.position?.x ?? 0) + offset.x,
          y: (s.position?.y ?? 0) + offset.y,
        },
      }));
      commitSteps([...steps, ...clones]);
      setSelectedIds(clones.map((c) => c.id));
    },
    [steps, commitSteps],
  );

  const copyToClipboard = useCallback(
    async (id: string) => {
      const s = steps.find((x) => x.id === id);
      if (!s) return;
      try {
        await navigator.clipboard.writeText(JSON.stringify({ type: 'peopleclaw.node', node: s }));
        toast.success('Copied');
      } catch {
        toast.error('Clipboard copy failed');
      }
    },
    [steps],
  );

  const pasteFromClipboard = useCallback(
    async (refId?: string) => {
      try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text) as { type?: string; node?: WorkflowStep };
        if (data?.type !== 'peopleclaw.node' || !data.node) {
          toast.error('Clipboard does not contain a node');
          return;
        }
        const ref = refId ? steps.find((s) => s.id === refId) : steps[steps.length - 1];
        const basePos = ref?.position ?? { x: 0, y: 0 };
        const cloned: WorkflowStep = {
          ...data.node,
          id: newStepId(),
          position: { x: basePos.x + 50, y: basePos.y + 50 },
        };
        commitSteps([...steps, cloned]);
        setSelectedIds([cloned.id]);
      } catch (e) {
        toast.error('Paste failed', { description: e instanceof Error ? e.message : String(e) });
      }
    },
    [steps, commitSteps],
  );

  const toggleDisabled = useCallback(
    (id: string) => {
      const next = steps.map((s) => (s.id === id ? { ...s, disabled: !s.disabled } : s));
      commitSteps(next);
    },
    [steps, commitSteps],
  );

  const runFromHere = useCallback(
    async (id: string) => {
      try {
        await apiClient.post(`/api/cases`, {
          workflowId: workflow.id,
          title: `Debug from ${id}`,
          payload: { startFromStep: id },
        });
        toast.success('Debug case created (engine support stubbed)');
      } catch (e) {
        toast.error('Could not create debug case', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [workflow.id],
  );

  const handleContextAction = useCallback(
    (action: string, nodeId: string) => {
      switch (action) {
        case 'edit':
          setSelectedIds([nodeId]);
          setActiveTab('properties');
          break;
        case 'duplicate':
          duplicateSteps([nodeId], { x: 50, y: 50 });
          break;
        case 'copy':
          void copyToClipboard(nodeId);
          break;
        case 'paste':
          void pasteFromClipboard(nodeId);
          break;
        case 'delete':
          deleteStepsWithUndo([nodeId]);
          break;
        case 'toggle-disabled':
          toggleDisabled(nodeId);
          break;
        case 'run-from-here':
          void runFromHere(nodeId);
          break;
      }
    },
    [duplicateSteps, copyToClipboard, pasteFromClipboard, deleteStepsWithUndo, toggleDisabled, runFromHere],
  );

  // Properties panel changes — live edit + debounced save (per spec)
  const handlePropChange = useCallback(
    (next: WorkflowStep) => {
      const updated = steps.map((s) => (s.id === next.id ? next : s));
      // Skip undo on every keystroke — debounce via save scheduler; push undo on blur is overkill.
      // Compromise: we push undo per call (it's already throttled by user's typing speed in practice).
      commitSteps(updated);
    },
    [steps, commitSteps],
  );

  // Auto-show properties tab when selecting a node
  useEffect(() => {
    if (selectedIds.length === 1 && activeTab !== 'properties') {
      setActiveTab('properties');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.length === 1 ? selectedIds[0] : null]);

  // ---- Hotkeys ----
  useHotkeys('mod+s', (e) => { e.preventDefault(); flush(); toast.success('Saved'); }, { enableOnFormTags: true });
  useHotkeys('mod+d', (e) => { e.preventDefault(); if (selectedIds.length) duplicateSteps(selectedIds); }, { enableOnFormTags: false });
  // Undo / Redo as named handlers (reused by hotkeys + footer buttons)
  const handleUndo = useCallback(() => {
    const prev = undo.undo();
    if (prev) {
      setSteps(prev);
      schedule({ ...workflow, steps: prev });
    } else if (undo.sizes().past === 0) {
      // PLANET-932 Bug 10: subtle feedback for empty undo stack
      toast.message('Nothing to undo', { duration: 1500 });
    }
  }, [undo, schedule, workflow]);

  const handleRedo = useCallback(() => {
    const nxt = undo.redo();
    if (nxt) {
      setSteps(nxt);
      schedule({ ...workflow, steps: nxt });
    } else if (undo.sizes().future === 0) {
      toast.message('Nothing to redo', { duration: 1500 });
    }
  }, [undo, schedule, workflow]);

  useHotkeys('mod+z', (e) => {
    e.preventDefault();
    handleUndo();
  });
  useHotkeys('mod+shift+z', (e) => {
    e.preventDefault();
    handleRedo();
  });
  useHotkeys('delete,backspace', (e) => {
    if (selectedIds.length === 0) return;
    e.preventDefault();
    deleteStepsWithUndo(selectedIds);
  });
  useHotkeys('mod+0', (e) => { e.preventDefault(); rf.fitView({ padding: 0.2 }); });
  // PLANET-928: register both 'shift+slash' (US layout where ? = shift+/) and the
  // direct '?' character with useKey=true so layouts that map ? to a different
  // physical key (e.g. AZERTY) still trigger the help overlay.
  useHotkeys('shift+slash', () => setHelpOpen(true), { enableOnFormTags: false });
  useHotkeys('?', () => setHelpOpen(true), { useKey: true, enableOnFormTags: false });

  // Save flush on unmount
  useEffect(() => () => { flush(); }, [flush]);

  // Layout sizes (3-column)
  const initial = useMemo(() => loadLayout(workflow.id, [60, 40]), [workflow.id]);
  const onLayoutChange = useCallback(
    (sizes: number[]) => saveLayout(workflow.id, sizes),
    [workflow.id],
  );

  const selectedStep = selectedIds.length === 1 ? steps.find((s) => s.id === selectedIds[0]) ?? null : null;
  const templateMeta = selectedStep?.templateId
    ? (() => {
        const tpl = templates.find((t) => t.id === selectedStep.templateId);
        if (!tpl) return undefined;
        return {
          label: tpl.label?.en ?? tpl.id,
          handler: tpl.handler,
          inputSchema: tpl.inputSchema,
          outputSchema: tpl.outputSchema,
          fromTemplate: true,
        };
      })()
    : undefined;

  // Case statuses → keyed by stepId (workflow step id)
  // PLANET-1127: when run is active or finished (status !== 'idle'), use ONLY
  // runState.stepStatuses. caseDetail is completely ignored — no partial merge,
  // no "skip if key exists" — physical elimination of the race condition path.
  const caseStatuses: Record<string, string> = useMemo(() => {
    const out: Record<string, string> = {};

    if (runState.status !== 'idle') {
      // Pre-fill all workflow steps as pending (grey border, no pulse)
      for (const s of workflow.steps) {
        out[s.id] = 'pending';
      }
      // Overlay runState — the single source of truth during/after a run
      for (const [k, v] of Object.entries(runState.stepStatuses)) {
        out[k] = v === 'done' ? 'done' : v === 'failed' ? 'failed' : v === 'pending' ? 'pending' : 'running';
      }
      return out;
    }

    // status === 'idle': no run active or ever started — use caseDetail
    if (caseDetail?.steps) {
      for (const s of caseDetail.steps) out[s.stepId] = s.status;
    }
    return out;
  }, [caseDetail, runState.status, runState.stepStatuses, workflow.steps]);

  const caseErrors: Record<string, string> = useMemo(() => {
    if (!caseDetail?.steps) return {};
    const out: Record<string, string> = {};
    for (const s of caseDetail.steps) if (s.error) out[s.stepId] = s.error;
    return out;
  }, [caseDetail]);

  // PLANET-1251: derive step mode overrides from case detail
  const caseModeOverrides: Record<string, 'auto' | 'human'> = useMemo(() => {
    if (!caseDetail?.stepModeOverrides) return {};
    try {
      return JSON.parse(caseDetail.stepModeOverrides);
    } catch {
      return {};
    }
  }, [caseDetail]);

  // PLANET-1127: when run finishes, lock all un-resolved steps immediately.
  // Catches any node that never received step:done (network drop / parse failure).
  useEffect(() => {
    if (runState.status !== 'done' && runState.status !== 'error') return;
    setRunState(prev => {
      let changed = false;
      const next = { ...prev.stepStatuses };
      for (const s of workflow.steps) {
        if (!(s.id in next) || next[s.id] === 'running' || next[s.id] === 'pending') {
          next[s.id] = prev.status === 'error' ? 'failed' : 'done';
          changed = true;
        }
      }
      if (!changed) return prev;
      console.log('[PLANET-1127 stepStatuses lock-on-finish]', next);
      return { ...prev, stepStatuses: next };
    });
  }, [runState.status, workflow.steps]);

  const runningPath = useMemo(() => {
    const set = new Set<string>();
    if (!caseDetail?.steps) return set;
    for (const s of caseDetail.steps) {
      if (s.status === 'done' || s.status === 'running' || s.status === 'in-progress') set.add(s.stepId);
    }
    return set;
  }, [caseDetail]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar with save indicator + help */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold truncate">{workflow.name}</h2>
          <span className="text-[10px] font-mono text-muted-foreground">
            {steps.length} steps · undo {undo.sizes().past}/{undo.sizes().future}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* PLANET-932 Bug 10: visible undo/redo buttons */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleUndo}
            disabled={undo.sizes().past === 0}
            data-testid="undo-button"
            title={`Undo (⌘Z) — ${undo.sizes().past} available`}
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleRedo}
            disabled={undo.sizes().future === 0}
            data-testid="redo-button"
            title={`Redo (⌘⇧Z) — ${undo.sizes().future} available`}
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <SaveIndicator state={saveState} />
          <Button
            size="sm"
            variant="default"
            className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            onClick={() => void handleRun()}
            disabled={runState.status === 'running' || steps.length === 0}
            data-testid="run-workflow-button"
            title="运行工作流"
          >
            {runState.status === 'running'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <PlayCircle className="h-3.5 w-3.5" />}
            <span>{runState.status === 'running' ? '运行中…' : '▶ 运行'}</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setHelpOpen(true)}
            data-testid="shortcut-help-button"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <PanelGroup direction="horizontal" onLayout={onLayoutChange} className="flex-1">
        <Panel defaultSize={initial[0] ?? 60} minSize={30}>
          <Canvas
            steps={steps}
            selectedIds={selectedIds}
            caseStatuses={caseStatuses}
            caseErrors={caseErrors}
            modeOverrides={caseModeOverrides}
            runningPath={runningPath}
            onSelectionChange={setSelectedIds}
            onPositionsChange={handlePositionsChange}
            onDropTemplate={handleDropTemplate}
            onErrorClick={(msg) => toast.error('Step failed', { description: msg })}
            onContextAction={handleContextAction}
            onPaneClick={() => setSelectedIds([])}
          />
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
        <Panel defaultSize={initial[1] ?? 40} minSize={20}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="flex flex-col h-full"
          >
            <TabsList className="grid grid-cols-3 mx-2 mt-2">
              <TabsTrigger value="properties" data-testid="tab-properties">{t('tabs.properties', { defaultValue: '属性' })}</TabsTrigger>
              <TabsTrigger value="cases" data-testid="tab-cases">{t('tabs.cases', { defaultValue: '案例' })}</TabsTrigger>
              <TabsTrigger value="runs" data-testid="tab-runs">{t('tabs.runs', { defaultValue: '运行记录' })}</TabsTrigger>
            </TabsList>
            <TabsContent value="properties" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
              <PropertiesPanel
                step={selectedStep}
                templateMeta={templateMeta}
                onChange={handlePropChange}
                onDelete={(id) => deleteStepsWithUndo([id])}
              />
            </TabsContent>
            <TabsContent value="cases" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
              <CasesPanel workflow={workflow} selectedCaseId={selectedCaseId} />
            </TabsContent>
            <TabsContent value="runs" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
              <RunsPanel workflowId={workflow.id} liveRun={runState} />
            </TabsContent>
          </Tabs>
        </Panel>
      </PanelGroup>

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export default function WorkflowEditor(props: {
  workflow: Workflow;
  selectedCaseId?: string | null;
  templates: StepTemplate[];
  onSaved?: () => void;
}) {
  return (
    <ReactFlowProvider>
      <EditorInner
        workflow={props.workflow}
        selectedCaseId={props.selectedCaseId ?? null}
        templates={props.templates}
        onSaved={props.onSaved}
      />
    </ReactFlowProvider>
  );
}
