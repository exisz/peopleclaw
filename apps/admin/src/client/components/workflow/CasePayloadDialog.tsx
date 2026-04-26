import { useCallback, useEffect, useState } from 'react';
// NOTE: do NOT use toast (sonner) here — its Portal conflicts with table polling re-render
// causing React insertBefore crash. Use inline status instead.
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiClient } from '../../lib/api';
import ImageUploader from '../ui/ImageUploader';
import { Save, Loader2, X } from 'lucide-react';

/** Fields we highlight at the top when present */
const KEY_FIELDS = ['product_name', 'price', 'stock', 'color', 'sku', 'image_url', 'description', 'category'];
const NUMBER_FIELDS = ['price', 'stock'];

function isNumberField(key: string, originalValue: unknown): boolean {
  return NUMBER_FIELDS.includes(key) || (typeof originalValue === 'number' && key !== 'product_name' && key !== 'description' && key !== 'image_url' && key !== 'category');
}

function isImageUrl(key: string, val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const k = key.toLowerCase();
  if (k.includes('image') || k.includes('img') || k.includes('photo') || k.includes('thumbnail')) return true;
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(val);
}

interface CasePayloadDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (newPayloadJson: string) => void;
  caseId: string;
  caseTitle: string;
  payload: Record<string, unknown>;
  requiredFields?: string[];
}

const FIELD_LABELS: Record<string, string> = {
  product_name: '商品名',
  price: '价格',
  stock: '库存',
  color: '颜色分类',
  sku: 'SKU',
  image_url: '商品图片',
  description: '描述',
  category: '分类',
};

export default function CasePayloadDialog({
  open,
  onClose,
  onSaved,
  caseId,
  caseTitle,
  payload,
  requiredFields = [],
}: CasePayloadDialogProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!open) { setInitialized(false); setSaved(false); setErrorMsg(null); return; }
    if (initialized) return;
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    // Internal/AI-generated fields that should not appear in the editor
    const HIDDEN_FIELDS = new Set([
      'title', 'model', 'imageUrl', 'mimeType', 'prompt', 'aspectRatio',
      'creditsRemaining', 'skus', 'skipped', 'reason', 'productId',
      'productAdminUrl', 'productHandle', 'productPublicUrl', 'shopifyTitle',
      'source', 'b64',
    ]);
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(safePayload)) {
      if (k.startsWith('_')) continue;
      if (HIDDEN_FIELDS.has(k)) continue;
      try {
        flat[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
      } catch {
        flat[k] = String(v ?? '');
      }
    }
    setFields(flat);
    setInitialized(true);
  }, [open, payload, initialized]);

  const updateField = useCallback((key: string, val: string) => {
    setFields((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const parsed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (NUMBER_FIELDS.includes(k) || (typeof payload[k] === 'number' && k !== 'product_name' && k !== 'description')) {
          parsed[k] = Number(v) || 0;
        } else {
          parsed[k] = v;
        }
      }
      const resp = await apiClient.patch<{ case: { payload: string } }>(`/api/cases/${caseId}/payload`, { fields: parsed });
      setSaved(true);
      // PLANET-1316: use server-merged payload (includes hidden fields) instead
      // of just visible fields — avoids losing title/imageUrl/skus in local state.
      onSaved?.(resp.case?.payload ?? JSON.stringify({ ...payload, ...parsed }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(`保存失败: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const sortedKeys = Object.keys(fields).sort((a, b) => {
    const aKey = KEY_FIELDS.indexOf(a);
    const bKey = KEY_FIELDS.indexOf(b);
    if (aKey !== -1 && bKey !== -1) return aKey - bKey;
    if (aKey !== -1) return -1;
    if (bKey !== -1) return 1;
    return a.localeCompare(b);
  });

  // Compute missing required fields
  const missingRequired = requiredFields.filter(f => {
    const v = fields[f];
    return !v || v.trim() === '' || v === '0';
  });
  const hasMissing = missingRequired.length > 0;

  if (!open) return null;

  // Simple overlay — NO Radix Dialog, NO Portal. Renders inline to avoid DOM crash.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col bg-background border border-border rounded-lg shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-sm font-semibold">📋 属性 — {caseTitle}</h3>
          <button onClick={onClose} className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-3 space-y-3">
          {sortedKeys.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">无属性字段，可在下方添加</p>
          )}
          {sortedKeys.map((key) => {
            const val = fields[key];
            const showImage = isImageUrl(key, val);
            const isKeyField = KEY_FIELDS.includes(key);
            const isRequired = requiredFields.includes(key);
            const isEmpty = !val || val.trim() === '' || val === '0';
            const isNum = isNumberField(key, payload[key]);

            return (
              <div key={key} className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  {isRequired ? <span className="text-red-500">*</span> : isKeyField ? <span className="text-amber-500">★</span> : null}
                  {FIELD_LABELS[key] || key}
                  {isRequired && isEmpty && <span className="text-red-400 text-[10px] ml-1">必填</span>}
                </Label>
                {showImage && val && (
                  <div className="rounded border bg-muted/30 p-2 mb-1">
                    <img
                      src={val}
                      alt={key}
                      className="max-h-32 rounded object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
                  <div className="space-y-1.5">
                    <Input
                      type="text"
                      className="h-8 text-xs"
                      value={val}
                      placeholder={(key === 'image_url' || isImageUrl(key, val)) ? '粘贴图片链接' : ''}
                      onChange={(e) => updateField(key, e.target.value)}
                    />
                    {(key === 'image_url' || isImageUrl(key, val)) && val && (
                      <div className="rounded border bg-muted/30 p-2">
                        <img
                          src={val}
                          alt={key}
                          className="max-h-24 rounded object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                    {(key === 'image_url' || isImageUrl(key, val)) && (
                      <ImageUploader
                        value=""
                        onChange={(url) => updateField(key, url)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* PLANET-1317: removed custom "add field" input — not needed for standard users */}
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t">
          {saved && <span className="text-xs text-emerald-600 font-medium mr-auto">✅ 已保存</span>}
          {errorMsg && <span className="text-xs text-red-600 font-medium mr-auto">❌ {errorMsg}</span>}
                    {hasMissing && (
            <span className="text-xs text-red-500 mr-auto">
              ❗ 还需填写: {missingRequired.map(f => FIELD_LABELS[f] || f).join(', ')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
