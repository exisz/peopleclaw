import { useState, useRef, useEffect } from 'react';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export interface SimpleMenuProps {
  items: MenuItem[];
  trigger?: React.ReactNode;
}

export function SimpleMenu({ items, trigger }: SimpleMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        {trigger ?? '⋯'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-md py-1 animate-in fade-in-0 zoom-in-95">
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none ${
                item.variant === 'destructive' ? 'text-destructive hover:text-destructive' : ''
              }`}
              onClick={(e) => { e.stopPropagation(); item.onClick(); setOpen(false); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
