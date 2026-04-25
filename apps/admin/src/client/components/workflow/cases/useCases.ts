import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../lib/api';
import type { CaseRecord, CaseStepRecord, FilterKey } from './types';

export interface UseCasesReturn {
  cases: CaseRecord[] | null;
  filtered: CaseRecord[] | null;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  creating: boolean;
  newTitle: string;
  setNewTitle: (v: string) => void;
  createCase: () => Promise<string | null>;
  deleteCase: (c: CaseRecord) => Promise<void>;
  completeCase: (c: CaseRecord) => Promise<void>;
  completing: string | null;
  continueCase: (c: CaseRecord) => Promise<void>;
  continuing: string | null;
  runAi: (c: CaseRecord) => Promise<void>;
  runningAi: string | null;
  openSteps: (c: CaseRecord) => Promise<{ c: CaseRecord; steps: CaseStepRecord[] } | null>;
  loadingSteps: string | null;
  batchContinue: () => Promise<void>;
  batchDelete: () => Promise<void>;
  batchDeleting: boolean;
  runSelected: () => Promise<void>;
  runningSelected: boolean;
  loadCases: () => Promise<void>;
  /** Update a case's payload in local state without re-fetching */
  patchCasePayload: (caseId: string, newPayload: string) => void;
}

export function useCases(workflowId: string): UseCasesReturn {
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [completing, setCompleting] = useState<string | null>(null);
  const [continuing, setContinuing] = useState<string | null>(null);
  const [runningAi, setRunningAi] = useState<string | null>(null);
  const [loadingSteps, setLoadingSteps] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [runningSelected, setRunningSelected] = useState(false);

  const loadCases = useCallback(async () => {
    try {
      const d = await apiClient.get<{ cases: CaseRecord[] }>('/api/cases');
      setCases((d.cases ?? []).filter((c) => c.workflowId === workflowId));
    } catch (err) {
      console.warn('[useCases] loadCases failed:', err);
    }
  }, [workflowId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const filtered = useMemo(() => {
    if (!cases) return null;
    return filter === 'all' ? cases : cases.filter((c) => c.status === filter);
  }, [cases, filter]);

  const createCase = useCallback(async (): Promise<string | null> => {
    if (!newTitle.trim()) return null;
    setCreating(true);
    try {
      const { case: c } = await apiClient.post<{ case: CaseRecord }>('/api/cases', {
        workflowId,
        title: newTitle.trim(),
        payload: {},
      });
      // Optimistic: prepend to local state
      setCases((prev) => [c, ...(prev ?? [])]);
      setNewTitle('');
      // Background sync
      loadCases().catch(() => {});
      return c.id;
    } catch (e) {
      console.error('[useCases] createCase failed:', e);
      return null;
    } finally {
      setCreating(false);
    }
  }, [workflowId, newTitle, loadCases]);

  const deleteCase = useCallback(async (c: CaseRecord) => {
    // Optimistic: remove immediately
    setCases((prev) => prev ? prev.filter((x) => x.id !== c.id) : prev);
    try {
      await apiClient.delete(`/api/cases/${c.id}`);
    } catch (e) {
      console.error('[useCases] deleteCase failed:', e);
      // Revert by reloading
      await loadCases();
    }
  }, [loadCases]);

  const completeCase = useCallback(async (c: CaseRecord) => {
    setCompleting(c.id);
    try {
      const { case: detail } = await apiClient.get<{
        case: CaseRecord & { steps?: Array<{ id: string; stepId: string; status: string }> };
      }>(`/api/cases/${c.id}`);
      const waitingStep = detail.steps?.find((s) => s.status === 'waiting_human');
      if (!waitingStep) return;
      await apiClient.post(`/api/cases/${c.id}/advance`, {
        stepId: waitingStep.stepId,
        output: { approved: true },
        action: 'approve',
      });
      await loadCases();
    } catch (e) {
      console.error('[useCases] completeCase failed:', e);
    } finally {
      setCompleting(null);
    }
  }, [loadCases]);

  const continueCase = useCallback(async (c: CaseRecord) => {
    setContinuing(c.id);
    try {
      await apiClient.post(`/api/cases/${c.id}/continue`);
      await loadCases();
    } catch (e) {
      console.error('[useCases] continueCase failed:', e);
    } finally {
      setContinuing(null);
    }
  }, [loadCases]);

  const runAi = useCallback(async (c: CaseRecord) => {
    setRunningAi(c.id);
    try {
      await apiClient.post(`/api/cases/${c.id}/run-ai`);
      await loadCases();
    } catch (e) {
      console.error('[useCases] runAi failed:', e);
    } finally {
      setRunningAi(null);
    }
  }, [loadCases]);

  const openSteps = useCallback(async (c: CaseRecord) => {
    setLoadingSteps(c.id);
    try {
      const { case: detail } = await apiClient.get<{
        case: { steps?: CaseStepRecord[] };
      }>(`/api/cases/${c.id}`);
      return { c, steps: detail.steps ?? [] };
    } catch (e) {
      console.error('[useCases] openSteps failed:', e);
      return null;
    } finally {
      setLoadingSteps(null);
    }
  }, []);

  const batchContinue = useCallback(async () => {
    if (!cases) return;
    const targets = cases.filter((c) => selectedIds.has(c.id) && c.status === 'waiting_review');
    if (!targets.length) return;
    for (const c of targets) {
      try {
        await apiClient.post(`/api/cases/${c.id}/continue`);
      } catch (e) {
        console.warn(`batch continue ${c.id} failed:`, e);
      }
    }
    setSelectedIds(new Set());
    await loadCases();
  }, [cases, selectedIds, loadCases]);

  const batchDelete = useCallback(async () => {
    setBatchDeleting(true);
    const ids = Array.from(selectedIds);
    // Optimistic: remove all selected immediately
    setCases((prev) => prev ? prev.filter((c) => !selectedIds.has(c.id)) : prev);
    for (const id of ids) {
      try {
        await apiClient.delete(`/api/cases/${id}`);
      } catch (e) {
        console.warn(`batch delete ${id} failed:`, e);
      }
    }
    setSelectedIds(new Set());
    setBatchDeleting(false);
    await loadCases();
  }, [selectedIds, loadCases]);

  const runSelected = useCallback(async () => {
    if (!cases) return;
    const target =
      cases.find((c) => selectedIds.has(c.id) && c.status === 'waiting_review') ??
      cases.find((c) => c.status === 'waiting_review');
    if (!target) return;
    setRunningSelected(true);
    try {
      await apiClient.post(`/api/cases/${target.id}/continue`);
      await loadCases();
    } catch (e) {
      console.error('[useCases] runSelected failed:', e);
    } finally {
      setRunningSelected(false);
    }
  }, [cases, selectedIds, loadCases]);

  return {
    cases,
    filtered,
    filter,
    setFilter: (f: FilterKey) => { setFilter(f); setSelectedIds(new Set()); },
    selectedIds,
    setSelectedIds,
    creating,
    newTitle,
    setNewTitle,
    createCase,
    deleteCase,
    completeCase,
    completing,
    continueCase,
    continuing,
    runAi,
    runningAi,
    openSteps,
    loadingSteps,
    batchContinue,
    batchDelete,
    batchDeleting,
    runSelected,
    runningSelected,
    loadCases,
    patchCasePayload: useCallback((caseId: string, newPayload: string) => {
      setCases(prev => prev ? prev.map(c => c.id === caseId ? { ...c, payload: newPayload } : c) : prev);
    }, []),
  };
}
