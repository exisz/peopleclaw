import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Workflow } from '../../../types';
import type { CaseRecord, CaseStepRecord } from './types';
import { useCases } from './useCases';
import { CaseFilters } from './CaseFilters';
import { CaseBatchBar } from './CaseBatchBar';
import { CasesTable } from './CasesTable';
import { SimpleAlertDialog } from '../../ui/simple-alert-dialog';
import BatchImportDialog from '../BatchImportDialog';
import CasePayloadDialog from '../CasePayloadDialog';
import CaseStepsDialog from '../CaseStepsDialog';

export default function CasesPanel({
  workflow,
  selectedCaseId,
}: {
  workflow: Workflow;
  selectedCaseId?: string | null;
}) {
  const navigate = useNavigate();
  const hook = useCases(workflow.id);

  // Dialog states
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [payloadCase, setPayloadCase] = useState<CaseRecord | null>(null);
  const [stepsCase, setStepsCase] = useState<{ c: CaseRecord; steps: CaseStepRecord[] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CaseRecord | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const handleCreateCase = async () => {
    const id = await hook.createCase();
    if (id) navigate(`/workflows/${workflow.id}/cases/${id}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await hook.deleteCase(target);
  };

  const handleBatchDelete = async () => {
    await hook.batchDelete();
    setBatchDeleteOpen(false);
  };

  const handleOpenSteps = async (c: CaseRecord) => {
    const result = await hook.openSteps(c);
    if (result) setStepsCase(result);
  };

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        <CaseFilters
          newTitle={hook.newTitle}
          setNewTitle={hook.setNewTitle}
          creating={hook.creating}
          onCreateCase={() => void handleCreateCase()}
          onBatchImport={() => setBatchDialogOpen(true)}
          filter={hook.filter}
          setFilter={hook.setFilter}
          runningSelected={hook.runningSelected}
          onRunSelected={() => void hook.runSelected()}
          stepsCount={workflow.steps.length}
          hasSelection={hook.selectedIds.size > 0}
        />

        <CaseBatchBar
          selectedCount={hook.selectedIds.size}
          onBatchContinue={() => void hook.batchContinue()}
          onBatchDelete={() => setBatchDeleteOpen(true)}
          onClearSelection={() => hook.setSelectedIds(new Set())}
        />

        {/* Run result banner */}
        {hook.lastRunResult && (
          <div className={`mx-2 mb-2 rounded-lg border p-3 text-xs flex items-center justify-between gap-2 ${
            hook.lastRunResult.status === 'done'
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 text-green-800 dark:text-green-200'
              : hook.lastRunResult.status === 'failed'
              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 text-red-800 dark:text-red-200'
              : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 text-amber-800 dark:text-amber-200'
          }`}>
            <div className="flex-1">
              {hook.lastRunResult.status === 'done' && (
                <div>
                  <span className="font-semibold">✅ 「{hook.lastRunResult.title}」运行完成！</span>
                  {hook.lastRunResult.productUrl && (
                    <a
                      href={hook.lastRunResult.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 underline font-medium"
                    >
                      🛍️ 查看商品
                    </a>
                  )}
                </div>
              )}
              {hook.lastRunResult.status === 'failed' && (
                <div>
                  <span className="font-semibold">❌ 「{hook.lastRunResult.title}」运行失败</span>
                  {hook.lastRunResult.error && (
                    <span className="ml-1 opacity-80">— {hook.lastRunResult.error}</span>
                  )}
                </div>
              )}
              {hook.lastRunResult.status !== 'done' && hook.lastRunResult.status !== 'failed' && (
                <span className="font-semibold">⚠️ 「{hook.lastRunResult.title}」状态：{hook.lastRunResult.status}</span>
              )}
            </div>
            <button
              onClick={() => hook.clearLastRunResult()}
              className="text-current opacity-50 hover:opacity-100 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        <CasesTable
          filtered={hook.filtered}
          workflow={workflow}
          selectedCaseId={selectedCaseId}
          selectedIds={hook.selectedIds}
          setSelectedIds={hook.setSelectedIds}
          completing={hook.completing}
          continuing={hook.continuing}
          runningAi={hook.runningAi}
          loadingSteps={hook.loadingSteps}
          onNavigate={(caseId) => navigate(`/workflows/${workflow.id}/cases/${caseId}`)}
          onDelete={setDeleteTarget}
          onComplete={(c) => void hook.completeCase(c)}
          onContinue={(c) => void hook.continueCase(c)}
          onRunAi={(c) => void hook.runAi(c)}
          onOpenPayload={setPayloadCase}
          onOpenSteps={(c) => void handleOpenSteps(c)}
          onRename={(c, newTitle) => void hook.renameCase(c, newTitle)}
          onRerun={(c) => void hook.rerunCase(c)}
        />
      </div>

      {/* Delete confirmation — no Portal */}
      <SimpleAlertDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete case?"
        description={`This will permanently delete "${deleteTarget?.title ?? ''}" and all its steps.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />

      {/* Batch delete confirmation — no Portal */}
      <SimpleAlertDialog
        open={batchDeleteOpen}
        onClose={() => setBatchDeleteOpen(false)}
        onConfirm={() => void handleBatchDelete()}
        title="批量删除案例？"
        description={`确定要删除选中的 ${hook.selectedIds.size} 个案例吗？此操作不可撤销。`}
        confirmLabel={hook.batchDeleting ? '删除中…' : '确认删除'}
        cancelLabel="取消"
        variant="destructive"
        confirmDisabled={hook.batchDeleting}
      />

      {/* Payload dialog */}
      {payloadCase && (
        <CasePayloadDialog
          open
          onClose={() => setPayloadCase(null)}
          onSaved={(newPayload) => {
            hook.patchCasePayload(payloadCase.id, newPayload);
          }}
          caseId={payloadCase.id}
          caseTitle={payloadCase.title}
          payload={(() => {
            try { return JSON.parse(payloadCase.payload || '{}'); }
            catch { return {}; }
          })()}
          requiredFields={(() => {
            // Collect all requiredFields from all steps (union)
            const all = new Set<string>();
            for (const s of workflow.steps ?? []) {
              for (const f of s.requiredFields ?? []) all.add(f);
            }
            return Array.from(all);
          })()}
        />
      )}

      {/* Steps dialog */}
      {stepsCase && (
        <CaseStepsDialog
          open
          onClose={() => setStepsCase(null)}
          caseTitle={stepsCase.c.title}
          steps={stepsCase.steps}
          onEditPayload={() => {
            const c = stepsCase.c;
            setStepsCase(null);
            setPayloadCase(c);
          }}
        />
      )}

      {/* Batch import */}
      <BatchImportDialog
        open={batchDialogOpen}
        onClose={() => setBatchDialogOpen(false)}
        workflowId={workflow.id}
        onSuccess={() => void hook.loadCases()}
      />
    </>
  );
}
