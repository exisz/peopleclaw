import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { apiClient } from '../../lib/api';
import { Save, Loader2, Image as ImageIcon } from 'lucide-react';

/** Fields we highlight at the top when present */
const KEY_FIELDS = ['product_name', 'price', 'stock', 'image_url', 'description'];

interface CasePayloadDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseTitle: string;
  payload: Record<string, unknown>;
  onSaved?: () => void;
}

function isNumeric(v: unknown): boolean {
  return typeof v === 'number' || (typeof v === 'string' && !Number.isNaN(Number(v)) && v.trim() !== '');
}

function isImageUrl(key: string, val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const k = key.toLowerCase();
  if (k.includes('image') || k.includes('img') || k.includes('photo') || k.includes('thumbnail')) return true;
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(val);
}

export default function CasePayloadDialog({
  open,
  onClose,
  caseId,
  caseTitle,
  payload,
  onSaved,
}: CasePayloadDialogProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Flatten payload to string key-values for editing
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k.startsWith('_')) continue; // skip internal fields like _error
      flat[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
    }
    setFields(flat);
  }, [open, payload]);

  const updateField = useCallback((key: string, val: string) => {
    setFields((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert numeric strings back to numbers
      const parsed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (isNumeric(v) && !isImageUrl(k, v)) {
          parsed[k] = Number(v);
        } else {
          parsed[k] = v;
        }
      }
      await apiClient.patch(`/api/cases/${caseId}/payload`, { fields: parsed });
      toast.success('属性已保存');
      onSaved?.();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('保存失败', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  // Sort: key fields first, then the rest alphabetically
  const sortedKeys = Object.keys(fields).sort((a, b) => {
    const aKey = KEY_FIELDS.indexOf(a);
    const bKey = KEY_FIELDS.indexOf(b);
    if (aKey !== -1 && bKey !== -1) return aKey - bKey;
    if (aKey !== -1) return -1;
    if (bKey !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">📋 属性 — {caseTitle}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-2 -mr-2">
          <div className="space-y-3 py-2">
            {sortedKeys.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">无属性字段</p>
            )}
            {sortedKeys.map((key) => {
              const val = fields[key];
              const showImage = isImageUrl(key, val);
              const isKeyField = KEY_FIELDS.includes(key);
              const isNum = isNumeric(payload[key]);

              return (
                <div key={key} className="space-y-1">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    {isKeyField && <span className="text-amber-500">★</span>}
                    {key}
                  </Label>
                  {showImage && val && (
                    <div className="rounded border bg-muted/30 p-2 mb-1">
                      <img
                        src={val}
                        alt={key}
                        className="max-h-32 rounded object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  {key === 'description' ? (
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px] resize-y"
                      value={val}
                      onChange={(e) => updateField(key, e.target.value)}
                    />
                  ) : (
                    <Input
                      type={isNum ? 'number' : 'text'}
                      className="h-8 text-xs"
                      value={val}
                      onChange={(e) => updateField(key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
