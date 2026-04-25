import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Workflow } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { cn } from '../../lib/utils';
import { BuildBadge } from '../BuildBadge';
import { useI18nField } from '../../i18n/useI18nField';
import { apiClient, ApiError } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Trash2, Lock, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export interface StepTemplate {
  id: string;
  category: string; // shopify | ai | generic | human
  domain: string;
  label: { en?: string; zh?: string };
  description: { en?: string; zh?: string };
  icon: string; // lucide-react icon name
  kind: 'auto' | 'human' | 'subflow';
  handler: string;
  defaultConfig: Record<string, unknown>;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export default function Sidebar({
  workflows,
  selected,
  onSelect,
  onAddStepTemplate,
  onDeleteWorkflow,
  onRenameWorkflow,
}: {
  workflows: Workflow[];
  selected: Workflow | null;
  onSelect: (w: Workflow) => void;
  onAddStepTemplate?: (template: StepTemplate) => void;
  onDeleteWorkflow?: (id: string) => void;
  onRenameWorkflow?: (id: string, newName: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'workflows' | 'library'>('workflows');
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);
  // PLANET-1210: force-delete confirmation (Tier B: self-built + has cases)
  const [forceDeleteTarget, setForceDeleteTarget] = useState<{ workflow: Workflow; casesCount: number } | null>(null);
  // PLANET-1257: inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { t } = useTranslation('workflow');
  const navigate = useNavigate();

  function startRename(w: Workflow) {
    setRenamingId(w.id);
    setRenameValue(w.name);
  }

  async function commitRename(w: Workflow) {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === w.name) {
      setRenamingId(null);
      return;
    }
    try {
      await apiClient.patch(`/api/workflows/${w.id}`, { name: trimmed });
      toast.success('已重命名', { description: trimmed });
      onRenameWorkflow?.(w.id, trimmed);
    } catch (e) {
      toast.error('重命名失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRenamingId(null);
    }
  }

  function cancelRename() {
    setRenamingId(null);
  }

  async function doDelete(workflow: Workflow, force = false) {
    setDeleting(true);
    try {
      const url = force
        ? `/api/workflows/${workflow.id}?force=true`
        : `/api/workflows/${workflow.id}`;
      await apiClient.delete(url);
      toast.success('已删除', { description: workflow.name });
      onDeleteWorkflow?.(workflow.id);
      setDeleteTarget(null);
      setForceDeleteTarget(null);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 409 && e.data?.cases_count != null) {
        // Tier B: has cases — ask for 2nd confirmation
        setDeleteTarget(null);
        setForceDeleteTarget({ workflow, casesCount: e.data.cases_count as number });
      } else if (e instanceof ApiError && e.status === 403 && e.data?.error === 'system_template') {
        toast.error('系统模板不可删除', { description: '请点「克隆」复制后修改' });
        setDeleteTarget(null);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('删除失败', { description: msg });
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleClone(workflow: Workflow) {
    try {
      const { workflow: cloned } = await apiClient.post<{ workflow: { id: string; name: string; category: string | null; isSystem: boolean; definition: unknown } }>(
        `/api/workflows/${workflow.id}/clone`,
        {},
      );
      toast.success(`已克隆「${cloned.name}」`, { description: '副本已加入工作流列表' });
      // Full reload so Workflows.tsx re-fetches the list and navigates to clone
      window.location.href = `/workflows/${cloned.id}`;
    } catch (e) {
      toast.error('克隆失败', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  const MY_WORKFLOWS_LABEL = '我的工作流';

  // PLANET-1065: Group by raw category string; uncategorized → "我的工作流".
  const grouped = useMemo(() => {
    const source = search.trim()
      ? workflows.filter(
          w =>
            w.name.toLowerCase().includes(search.toLowerCase()) ||
            w.description.toLowerCase().includes(search.toLowerCase()),
        )
      : workflows;

    const buckets = new Map<string, Workflow[]>();
    for (const w of source) {
      const key = w.category?.trim() || MY_WORKFLOWS_LABEL;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(w);
    }
    // Categorised groups first (alphabetical), then "我的工作流" last.
    // PLANET-1098: Sort items within each group by name so e.g. "默认工作流1" appears before "默认工作流2".
    const sortItems = (items: Workflow[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    const result: { key: string; label: string; items: Workflow[] }[] = [];
    const categorised = [...buckets.entries()].filter(([k]) => k !== MY_WORKFLOWS_LABEL);
    categorised.sort(([a], [b]) => a.localeCompare(b));
    for (const [k, items] of categorised) result.push({ key: k, label: k, items: sortItems(items) });
    if (buckets.has(MY_WORKFLOWS_LABEL)) result.push({ key: MY_WORKFLOWS_LABEL, label: MY_WORKFLOWS_LABEL, items: sortItems(buckets.get(MY_WORKFLOWS_LABEL)!) });
    return result;
  }, [workflows, search]);

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col overflow-hidden border-r border-border bg-card">
      {/* Tabs */}
      <div className="px-3 pt-3 grid grid-cols-2 gap-1">
        <Button
          size="sm"
          variant={tab === 'workflows' ? 'secondary' : 'ghost'}
          className="text-xs"
          onClick={() => setTab('workflows')}
          data-testid="sidebar-tab-workflows"
        >
          {t('tabs.workflows', { defaultValue: 'Workflows' })}
        </Button>
        <Button
          size="sm"
          variant={tab === 'library' ? 'secondary' : 'ghost'}
          className="text-xs"
          onClick={() => setTab('library')}
          data-testid="sidebar-tab-library"
        >
          {t('tabs.library', { defaultValue: 'STEP操作流程' })}
        </Button>
      </div>

      {tab === 'workflows' ? (
        <>
          {/* Search */}
          <div className="px-5 pt-3 pb-2">
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 text-xs"
              data-testid="sidebar-search"
            />
          </div>

          {/* Workflow list */}
          <ScrollArea className="flex-1 px-3">
            <nav className="py-2">
              {grouped.map((g, gi) => (
                <div key={g.key} className="mb-3">
                  {gi > 0 && <Separator className="mb-2" />}
                  <p
                    className="text-[10px] text-muted-foreground mb-1.5 px-2"
                    data-testid={`sidebar-category-${g.key}`}
                  >
                    {g.label}
                  </p>
                  {g.items.map(w => (
                    <div key={w.id} className="flex items-center group">
                      {renamingId === w.id ? (
                        <div className="flex-1 flex items-center gap-1 px-2 py-1">
                          <span className="text-lg leading-none">{w.icon}</span>
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(w);
                              if (e.key === 'Escape') cancelRename();
                            }}
                            onBlur={() => commitRename(w)}
                            className="h-7 flex-1 text-sm"
                            autoFocus
                            data-testid={`sidebar-rename-input-${w.id}`}
                          />
                        </div>
                      ) : (
                      <Button
                        variant={selected?.id === w.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          'flex-1 justify-start gap-3 h-auto py-2 px-3 text-sm font-normal',
                          selected?.id === w.id && 'font-medium',
                        )}
                        onClick={() => onSelect(w)}
                        data-testid={`sidebar-workflow-${w.id}`}
                      >
                        <span className="text-lg leading-none">{w.icon}</span>
                        <span className="truncate flex-1 text-left">{w.name}</span>
                        {w.isSystem && <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {w.steps.length}
                        </span>
                      </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-40 group-hover:opacity-100 shrink-0"
                            data-testid={`sidebar-workflow-menu-${w.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {w.isSystem ? (
                            // Tier C: system template — lock icon + clone button
                            <>
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed" data-testid={`sidebar-workflow-locked-${w.id}`}>
                                      <Lock className="h-3.5 w-3.5" />
                                      <span>系统模板</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[200px] text-xs">
                                    系统模板不可删除，可点「克隆」复制后修改
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); startRename(w); }}
                                data-testid={`sidebar-workflow-rename-${w.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleClone(w); }}
                                data-testid={`sidebar-workflow-clone-${w.id}`}
                              >
                                克隆
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); startRename(w); }}
                              data-testid={`sidebar-workflow-rename-${w.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              重命名
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(w); }}
                              data-testid={`sidebar-workflow-delete-${w.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              删除
                            </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex flex-col items-center gap-1">
            <p className="text-[10px] font-mono text-muted-foreground text-center">
              {t('footerCount', { count: workflows.length })}
            </p>
            <BuildBadge />
          </div>
        </>
      ) : (
        <StepLibraryPanel onAdd={onAddStepTemplate} />
      )}

      {/* PLANET-1210 Tier A: simple confirmation (no cases) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除工作流</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.name}」，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && doDelete(deleteTarget, false)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-workflow"
            >
              {deleting ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PLANET-1210 Tier B: force-delete confirmation (has cases) */}
      <AlertDialog open={!!forceDeleteTarget} onOpenChange={(open) => { if (!open) setForceDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除工作流和案例</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{forceDeleteTarget?.workflow.name}」及关联的{' '}
              <strong>{forceDeleteTarget?.casesCount}</strong> 个案例。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => forceDeleteTarget && doDelete(forceDeleteTarget.workflow, true)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-force-delete-workflow"
            >
              {deleting ? '删除中…' : '确定删除全部'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function StepLibraryPanel({ onAdd }: { onAdd?: (template: StepTemplate) => void }) {
  const { t } = useTranslation('workflow');
  const [templates, setTemplates] = useState<StepTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ templates: StepTemplate[] }>('/api/step-templates')
      .then((d) => { if (!cancelled) setTemplates(d.templates); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    if (!templates) return [];
    const order = ['shopify', 'ai', 'generic', 'human'];
    const buckets = new Map<string, StepTemplate[]>();
    for (const t of templates) {
      const k = t.category;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(t);
    }
    return order
      .filter((k) => buckets.has(k))
      .map((k) => ({ key: k, items: buckets.get(k)! }));
  }, [templates]);

  if (error) {
    return (
      <div className="p-4 text-xs text-destructive" data-testid="step-library-error">
        Failed to load step library: {error}
      </div>
    );
  }
  if (!templates) {
    return (
      <div className="p-4 text-xs text-muted-foreground" data-testid="step-library-loading">
        Loading…
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-3 pt-2">
      <TooltipProvider delayDuration={200}>
        <div className="py-2">
          {grouped.map((g, gi) => (
            <div key={g.key} className="mb-3">
              <p
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 px-2"
                data-testid={`step-library-cat-${g.key}`}
              >
                {t(`stepLibrary.cat.${g.key}`, { defaultValue: g.key })}
              </p>
              {g.items.map((tpl) => (
                <StepLibraryItem key={tpl.id} template={tpl} onAdd={onAdd} />
              ))}
              {gi < grouped.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </div>
      </TooltipProvider>
    </ScrollArea>
  );
}

function StepLibraryItem({
  template,
  onAdd,
}: {
  template: StepTemplate;
  onAdd?: (template: StepTemplate) => void;
}) {
  const label = useI18nField(template.label);
  const description = useI18nField(template.description);
  const Icon: LucideIcon =
    (LucideIcons as unknown as Record<string, LucideIcon>)[template.icon] ??
    (LucideIcons as unknown as Record<string, LucideIcon>).Box;

  const button = (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 h-auto py-2 px-3 text-xs font-normal cursor-grab active:cursor-grabbing"
      onClick={() => onAdd?.(template)}
      draggable
      onDragStart={(e) => {
        const payload = JSON.stringify({
          type: 'peopleclaw.step-template',
          templateId: template.id,
          template,
        });
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.setData('text/plain', template.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      data-testid={`step-template-${template.id}`}
      data-step-template={template.id}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1 text-left">{label || template.id}</span>
    </Button>
  );

  if (!description) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs text-xs">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
