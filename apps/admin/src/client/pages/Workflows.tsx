import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { workflows as initialWorkflows } from '../data/workflows';
import { cases as allCases } from '../data/cases';
import type { Workflow, Case } from '../data/types';
import Sidebar from '../components/workflow/Sidebar';
import TopBar from '../components/workflow/TopBar';
import WorkflowView from '../components/workflow/WorkflowView';
import CasesView from '../components/workflow/CasesView';

const STORAGE_KEY = 'peopleclaw-workflows';

function loadWorkflows(): Workflow[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return initialWorkflows;
}

function saveWorkflows(wfs: Workflow[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wfs));
  } catch {
    /* ignore */
  }
}

export default function Workflows() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [workflows, setWorkflows] = useState<Workflow[]>(loadWorkflows);

  const initial = id ? workflows.find((w) => w.id === id) ?? workflows[0] : workflows[0];
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>(initial);
  const [activeTab, setActiveTab] = useState<'workflow' | 'cases'>('workflow');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  // Sync URL → state when :id changes
  useEffect(() => {
    if (id) {
      const found = workflows.find((w) => w.id === id);
      if (found && found.id !== selectedWorkflow.id) {
        setSelectedWorkflow(found);
        setSelectedCase(null);
        setActiveTab('workflow');
      }
    }
  }, [id, workflows, selectedWorkflow.id]);

  const handleSelect = useCallback(
    (w: Workflow) => {
      setSelectedWorkflow(w);
      setSelectedCase(null);
      setActiveTab('workflow');
      navigate(`/workflows/${w.id}`);
    },
    [navigate],
  );

  const handleWorkflowUpdate = useCallback((updated: Workflow) => {
    setWorkflows((prev) => {
      const next = prev.map((w) => (w.id === updated.id ? updated : w));
      saveWorkflows(next);
      return next;
    });
  }, []);

  const workflowCases = allCases.filter((c) => c.workflowId === selectedWorkflow.id);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar workflows={workflows} selected={selectedWorkflow} onSelect={handleSelect} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          workflow={selectedWorkflow}
          caseCount={workflowCases.length}
          activeTab={activeTab}
          onTabChange={(t) => {
            setActiveTab(t);
            if (t === 'workflow') setSelectedCase(null);
          }}
        />
        <main className="flex-1 overflow-hidden bg-muted/30">
          {activeTab === 'workflow' ? (
            <WorkflowView
              workflow={selectedWorkflow}
              selectedCase={selectedCase}
              onWorkflowUpdate={handleWorkflowUpdate}
            />
          ) : (
            <CasesView
              cases={workflowCases}
              workflow={selectedWorkflow}
              selectedCase={selectedCase}
              onSelectCase={(c) => {
                setSelectedCase(c);
                setActiveTab('workflow');
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
