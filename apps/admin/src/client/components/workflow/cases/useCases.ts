import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../../lib/api';
import type { CaseRecord, CaseStepRecord, FilterKey } from './types';

export interface UseCasesReturn {
  cases: CaseRecord[] | null;
  filtered: CaseRecord[] | null;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
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
  lastRunResult: { status: string; title: string; error?: string; productUrl?: string } | null;
  clearLastRunResult: () => void;
  loadCases: () => Promise<void>;
  /** Update a case's payload in local state without re-fetching */
  patchCasePayload: (caseId: string, newPayload: string) => void;
  /** Rename a case title via PATCH /api/cases/:id */
  renameCase: (c: CaseRecord, newTitle: string) => Promise<void>;
  /** PLANET-1323: Rerun a completed case (reset to waiting_human) */
  rerunCase: (c: CaseRecord) => Promise<void>;
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
  const [lastRunResult, setLastRunResult] = useState<{ status: string; title: string; error?: string; productUrl?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCases = useCallback(async () => {
    try {
      const d = await apiClient.get<{ cases: CaseRecord[] }>(`/api/cases?workflowId=${encodeURIComponent(workflowId)}`);
      setCases(d.cases ?? []);
    } catch (err) {
      console.warn('[useCases] loadCases failed:', err);
    }
  }, [workflowId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const filtered = useMemo(() => {
    if (!cases) return null;
    let result = filter === 'all' ? cases : cases.filter((c) => c.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }
    return result;
  }, [cases, filter, searchQuery]);

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
    const targets = cases.filter((c) => selectedIds.has(c.id) && c.status === 'running');
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
  }, [loadCases]);

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

  // Use refs to avoid stale closure in callbacks
  const casesRef = useRef(cases);
  casesRef.current = cases;
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;

  const runSelected = useCallback(async () => {
    const currentCases = casesRef.current;
    const currentSelected = selectedRef.current;
    if (!currentCases || currentSelected.size === 0) return;
    // Only run explicitly selected case
    const target = currentCases.find((c) => currentSelected.has(c.id));
    if (!target) return;
    setRunningSelected(true);
    setLastRunResult(null);
    try {
      const resp = await apiClient.post<{ case: CaseRecord; result?: { status: string; lastStepId?: string } }>(`/api/cases/${target.id}/continue`);
      // Optimistic update from response
      if (resp?.case) {
        setCases(prev => prev ? prev.map(c => c.id === resp.case.id ? resp.case : c) : prev);
        // Extract run result for user feedback
        const payload = (() => { try { return JSON.parse(resp.case.payload || '{}'); } catch { return {}; } })();
        const productUrl = typeof payload.productAdminUrl === 'string' ? payload.productAdminUrl : (typeof payload.productPublicUrl === 'string' ? payload.productPublicUrl : undefined);
        if (resp.case.status === 'done') {
          setLastRunResult({ status: 'done', title: resp.case.title, productUrl });
        } else if (resp.case.status === 'failed') {
          const failedStep = resp.case.steps?.find((s: any) => s.status === 'failed');
          setLastRunResult({ status: 'failed', title: resp.case.title, error: failedStep?.error || '未知错误' });
        } else {
          setLastRunResult({ status: resp.case.status, title: resp.case.title });
        }
      } else {
        await loadCases();
      }
    } catch (e) {
      console.error('[useCases] runSelected failed:', e);
      setLastRunResult({ status: 'failed', title: target.title, error: e instanceof Error ? e.message : '运行失败' });
      await loadCases();
    } finally {
      setRunningSelected(false);
    }
  }, [loadCases]);

  return {
    cases,
    filtered,
    filter,
    setFilter: (f: FilterKey) => { setFilter(f); setSelectedIds(new Set()); },
    searchQuery,
    setSearchQuery,
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
    lastRunResult,
    clearLastRunResult: () => setLastRunResult(null),
    loadCases,
    patchCasePayload: useCallback((caseId: string, newPayload: string) => {
      setCases(prev => prev ? prev.map(c => c.id === caseId ? { ...c, payload: newPayload } : c) : prev);
    }, []),
    renameCase: useCallback(async (c: CaseRecord, newTitle: string) => {
      // Optimistic update
      setCases(prev => prev ? prev.map(x => x.id === c.id ? { ...x, title: newTitle } : x) : prev);
      try {
        await apiClient.patch(`/api/cases/${c.id}`, { title: newTitle });
      } catch (e) {
        console.error('[useCases] renameCase failed:', e);
        await loadCases();
      }
    }, [loadCases]),
    // PLANET-1323: rerun a completed case
    rerunCase: useCallback(async (c: CaseRecord) => {
      try {
        const resp = await apiClient.post<{ case: CaseRecord }>(`/api/cases/${c.id}/rerun`);
        setCases(prev => prev ? prev.map(x => x.id === c.id ? resp.case : x) : prev);
      } catch (e) {
        console.error('[useCases] rerunCase failed:', e);
      }
    }, []),
  };
}
