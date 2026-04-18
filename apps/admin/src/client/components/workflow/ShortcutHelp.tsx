import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

const SHORTCUTS: { group: string; items: { keys: string; desc: string }[] }[] = [
  {
    group: 'Editing',
    items: [
      { keys: '⌘S', desc: 'Save now (cancel debounce)' },
      { keys: '⌘D', desc: 'Duplicate selected node(s)' },
      { keys: '⌘Z / ⌘⇧Z', desc: 'Undo / Redo' },
      { keys: '⌫ / Del', desc: 'Delete selected (with toast undo)' },
    ],
  },
  {
    group: 'Navigation',
    items: [
      { keys: 'Space + drag', desc: 'Pan canvas' },
      { keys: '⌘0', desc: 'Fit view' },
      { keys: 'Right-click node', desc: 'Open context menu' },
    ],
  },
  {
    group: 'Help',
    items: [{ keys: '?', desc: 'Open this shortcut overlay' }],
  },
];

export default function ShortcutHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('workflow');
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-testid="shortcut-help-overlay">
        <DialogHeader>
          <DialogTitle>{t('shortcuts.title', { defaultValue: 'Keyboard Shortcuts' })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {SHORTCUTS.map((g) => (
            <div key={g.group}>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                {t(`shortcuts.group.${g.group.toLowerCase()}`, { defaultValue: g.group })}
              </h4>
              <table className="w-full text-xs">
                <tbody>
                  {g.items.map((it) => (
                    <tr key={it.keys}>
                      <td className="py-1 pr-3 font-mono text-[11px] text-foreground/80 whitespace-nowrap">
                        {it.keys}
                      </td>
                      <td className="py-1 text-muted-foreground">{it.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
