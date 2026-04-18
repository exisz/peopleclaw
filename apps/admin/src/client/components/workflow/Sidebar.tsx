import { useState } from 'react';
import type { Workflow } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';

const categories = [
  '电商运营', '营销推广', '资产管理', '销售管理', '人力资源',
  '技术支持', '供应链', '创意设计', '财务管理', '产品研发',
];

export default function Sidebar({
  workflows,
  selected,
  onSelect,
}: {
  workflows: Workflow[];
  selected: Workflow;
  onSelect: (w: Workflow) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? workflows.filter(
        w =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.description.toLowerCase().includes(search.toLowerCase()),
      )
    : workflows;

  const grouped = categories
    .map(cat => ({ category: cat, items: filtered.filter(w => w.category === cat) }))
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

      {/* Search */}
      <div className="px-5 pt-4 pb-2">
        <Input
          type="text"
          placeholder="Search workflows..."
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
            <div key={g.category} className="mb-3">
              <p
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 px-2"
                data-testid={`sidebar-category-${g.category}`}
              >
                {g.category}
              </p>
              {g.items.map(w => (
                <Button
                  key={w.id}
                  variant={selected.id === w.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-3 h-auto py-2 px-3 text-sm font-normal',
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
              ))}
              {gi < grouped.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border">
        <p className="text-[10px] font-mono text-muted-foreground text-center">
          v0.2 · {workflows.length} workflows
        </p>
      </div>
    </aside>
  );
}
