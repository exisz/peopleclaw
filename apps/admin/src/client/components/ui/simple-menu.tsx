import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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

/**
 * Non-Radix dropdown menu. Uses createPortal to render the dropdown
 * at document.body level so it's never clipped by overflow:hidden parents.
 * This avoids the React reconciliation crashes caused by Radix DropdownMenu Portals
 * because we own the lifecycle and don't do focus-trapping or complex aria.
 */
export function SimpleMenu({ items, trigger }: SimpleMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.right - 160, // align right edge
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, updatePos]);

  const dropdown = open && pos ? createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.top, left: Math.max(8, pos.left), zIndex: 9999 }}
      className="min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1"
    >
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
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        {trigger ?? '⋯'}
      </button>
      {dropdown}
    </>
  );
}
