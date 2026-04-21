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
import { apiClient } from '../../lib/api';
import LEGACY_ZH_TO_KEY from '../../i18n/locales/zh/legacy-category-map.json';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_KEYS = [
  'ecommerce', 'marketing', 'asset', 'sales', 'hr',
  'support', 'supply', 'design', 'finance', 'product',
] as const;

function categoryToKey(category: string | undefined | null): string {
  if (!category) return 'product';
  if ((CATEGORY_KEYS as readonly string[]).includes(category)) return category;
  return (LEGACY_ZH_TO_KEY as Record<string, string>)[category] ?? category;
}

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
}: {
  workflows: Workflow[];
  selected: Workflow;
  onSelect: (w: Workflow) => void;
  onAddStepTemplate?: (template: StepTemplate) => void;
  onDeleteWorkflow?: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'workflows' | 'library'>('workflows');
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation('workflow');

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/workflows/${deleteTarget.id}`);
      toast.success('工作流已删除', { description: deleteTarget.name });
      onDeleteWorkflow?.(deleteTarget.id);
    } catch (e: unknown) {
      toast.error('删除失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const filtered = search.trim()
    ? workflows.filter(
        w =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.description.toLowerCase().includes(search.toLowerCase()),
      )
    : workflows;

  const grouped = CATEGORY_KEYS
    .map(key => ({
      key,
      label: t(`categories.${key}`),
      items: filtered.filter(w => categoryToKey(w.category) === key),
    }))
    .filter(g => g.items.length > 0);

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col overflow-hidden border-r border-border bg-card">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-primary-foreground bg-gradient-to-br from-primary to-accent shadow">
            P
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">PeopleClaw</h1>
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
              Workflow Engine
            </p>
          </div>
        </div>
      </div>

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
          {t('tabs.library', { defaultValue: 'Step Library' })}
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
                  <p
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 px-2"
                    data-testid={`sidebar-category-${g.key}`}
                  >
                    {g.label}
                  </p>
                  {g.items.map(w => (
                    <div key={w.id} className="flex items-center group">
                      <Button
                        variant={selected.id === w.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          'flex-1 justify-start gap-3 h-auto py-2 px-3 text-sm font-normal',
                          selected.id === w.id && 'font-medium',
                        )}
                        onClick={() => onSelect(w)}
                        data-testid={`sidebar-workflow-${w.id}`}
                      >
                        <span className="text-lg leading-none">{w.icon}</span>
                        <span className="truncate flex-1 text-left">{w.name}</span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {w.steps.length}
                        </span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                            data-testid={`sidebar-workflow-menu-${w.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(w); }}
                            data-testid={`sidebar-workflow-delete-${w.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  {gi < grouped.length - 1 && <Separator className="my-2" />}
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

      {/* PLANET-1052: delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除工作流</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.name}」，此操作不可恢复。有履历案例的工作流不能删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-workflow"
            >
              {deleting ? '删除中…' : '确认删除'}
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
