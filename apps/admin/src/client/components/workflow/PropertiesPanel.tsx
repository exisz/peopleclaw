import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { WorkflowStep } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/select';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PropertiesPanelProps {
  step: WorkflowStep | null;
  // metadata from template if step originated from one
  templateMeta?: {
    label?: string;
    handler?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    fromTemplate?: boolean;
  };
  // Live update — debounced save handled by parent
  onChange: (next: WorkflowStep) => void;
  onDelete: (stepId: string) => void;
  onChangeTemplate?: (stepId: string) => void;
}

const TYPE_OPTIONS: { value: WorkflowStep['type']; label: string }[] = [
  { value: 'agent', label: '🤖 Auto' },
  { value: 'human', label: '👤 Human' },
  { value: 'subflow', label: '📂 Subflow' },
];

export default function PropertiesPanel({
  step,
  templateMeta,
  onChange,
  onDelete,
  onChangeTemplate,
}: PropertiesPanelProps) {
  const { t } = useTranslation('workflow');
  const [configText, setConfigText] = useState<string>('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [i18nMode, setI18nMode] = useState(false);
  const [snapshot, setSnapshot] = useState<WorkflowStep | null>(null); // Cancel reverts here

  useEffect(() => {
    if (!step) {
      setConfigText('');
      setConfigError(null);
      setSnapshot(null);
      return;
    }
    setSnapshot(step);
    // Try to extract config JSON from tools[] convention `config:<json>` if present
    const cfgTool = step.tools?.find((x) => x.startsWith('config:'));
    if (cfgTool) {
      try {
        const parsed = JSON.parse(cfgTool.slice('config:'.length));
        setConfigText(JSON.stringify(parsed, null, 2));
      } catch {
        setConfigText(cfgTool.slice('config:'.length));
      }
    } else {
      setConfigText('{}');
    }
    setConfigError(null);
  }, [step?.id]);

  if (!step) {
    return (
      <div
        className="flex items-center justify-center h-full p-6 text-center text-xs text-muted-foreground"
        data-testid="properties-panel-empty"
      >
        {t('properties.empty', { defaultValue: 'Select a node to edit its properties' })}
      </div>
    );
  }

  const fromTemplate = templateMeta?.fromTemplate ?? false;

  const update = (patch: Partial<WorkflowStep>) => {
    onChange({ ...step, ...patch });
  };

  const saveConfig = () => {
    try {
      const parsed = JSON.parse(configText || '{}');
      const otherTools = (step.tools ?? []).filter((x) => !x.startsWith('config:'));
      onChange({ ...step, tools: [...otherTools, `config:${JSON.stringify(parsed)}`] });
      setConfigError(null);
      toast.success(t('properties.configSaved', { defaultValue: 'Config saved' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConfigError(msg);
      toast.error(t('properties.configInvalid', { defaultValue: 'Invalid JSON' }), { description: msg });
    }
  };

  const cancel = () => {
    if (snapshot) onChange(snapshot);
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      data-testid="properties-panel"
    >
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{step.name || step.id}</h3>
          <p className="text-[10px] font-mono text-muted-foreground">{step.id}</p>
        </div>
        {fromTemplate && (
          <Badge variant="outline" className="text-[10px]">
            {t('properties.fromTemplate', { defaultValue: 'Template' })}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="prop-name">{t('properties.name', { defaultValue: 'Name' })}</Label>
            <button
              type="button"
              onClick={() => setI18nMode((v) => !v)}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
              data-testid="properties-name-i18n-toggle"
            >
              {i18nMode ? 'plain' : 'i18n'}
            </button>
          </div>
          <Input
            id="prop-name"
            data-testid="properties-name"
            value={step.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          {i18nMode && (
            <p className="text-[10px] text-muted-foreground">
              {t('properties.i18nHint', {
                defaultValue: 'i18n storage stub — name persisted as plain string until schema upgrade.',
              })}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t('properties.type', { defaultValue: 'Step Type' })}</Label>
          <Select
            value={step.type}
            onValueChange={(v) => update({ type: v as WorkflowStep['type'] })}
            disabled={fromTemplate}
          >
            <SelectTrigger data-testid="properties-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('properties.handler', { defaultValue: 'Handler' })}</Label>
          <div className="flex items-center gap-2">
            <Input
              data-testid="properties-handler"
              readOnly={fromTemplate}
              value={
                templateMeta?.handler ??
                step.tools?.find((x) => x.startsWith('handler:'))?.slice('handler:'.length) ??
                ''
              }
              onChange={(e) => {
                const v = e.target.value;
                const others = (step.tools ?? []).filter((x) => !x.startsWith('handler:'));
                update({ tools: [...others, `handler:${v}`] });
              }}
            />
            {fromTemplate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onChangeTemplate?.(step.id)}
                data-testid="properties-change-template"
              >
                {t('properties.change', { defaultValue: 'Change' })}
              </Button>
            )}
          </div>
          {templateMeta?.label && (
            <p className="text-[10px] text-muted-foreground">{templateMeta.label}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-desc">{t('properties.description', { defaultValue: 'Description' })}</Label>
          <Textarea
            id="prop-desc"
            data-testid="properties-description"
            rows={3}
            value={step.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        {step.type === 'human' && (
          <div className="space-y-1.5">
            <Label htmlFor="prop-assignee">{t('properties.assignee', { defaultValue: 'Assignee' })}</Label>
            <Input
              id="prop-assignee"
              data-testid="properties-assignee"
              value={step.assignee}
              onChange={(e) => update({ assignee: e.target.value })}
              placeholder="user@example.com"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="prop-config">{t('properties.config', { defaultValue: 'Config (JSON)' })}</Label>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={saveConfig}
              data-testid="properties-config-save"
            >
              {t('properties.applyConfig', { defaultValue: 'Apply' })}
            </Button>
          </div>
          <Textarea
            id="prop-config"
            data-testid="properties-config"
            rows={6}
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            className="font-mono text-[11px]"
            spellCheck={false}
          />
          {configError && (
            <p className="text-[10px] text-destructive">{configError}</p>
          )}
        </div>

        <div className="border rounded">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium"
            onClick={() => setSchemaOpen((v) => !v)}
            data-testid="properties-schema-toggle"
          >
            <span>{t('properties.schemas', { defaultValue: 'Input / Output Schema' })}</span>
            {schemaOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          {schemaOpen && (
            <div className="px-3 pb-3 space-y-2">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">input</p>
                <pre className={cn('text-[10px] bg-muted/50 p-2 rounded overflow-auto max-h-32')}>
                  {JSON.stringify(templateMeta?.inputSchema ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">output</p>
                <pre className={cn('text-[10px] bg-muted/50 p-2 rounded overflow-auto max-h-32')}>
                  {JSON.stringify(templateMeta?.outputSchema ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(step.id)}
          data-testid="properties-delete"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {t('properties.delete', { defaultValue: 'Delete' })}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={cancel}
            data-testid="properties-cancel"
          >
            {t('properties.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            size="sm"
            onClick={() => toast.success(t('properties.saved', { defaultValue: 'Saved' }))}
            data-testid="properties-save"
          >
            {t('properties.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
