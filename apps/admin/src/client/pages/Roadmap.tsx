/**
 * PLANET-1204: PeopleClaw Roadmap Hub
 * Public page — no auth required.
 * - Stage summary cards with progress bars
 * - Grouped table with filters + search
 * - CSV export link
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download, Search, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import roadmapRaw from '../../data/roadmap.yaml?raw';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoadmapItem {
  id: string;
  title: string;
  category: string;
  stage: number;
  status: 'done' | 'in_progress' | 'todo' | 'rejected' | 'blocked';
  description: string;
  prerequisites: string[];
  jira?: string;
  completed_at?: string;
  commit_sha?: string;
  reject_reason?: string;
}

// ─── YAML parser (no deps — lightweight hand-rolled) ─────────────────────────

function parseRoadmapYaml(raw: string): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  // Strip comment-only lines
  const lines = raw.split('\n').filter(l => !l.trimStart().startsWith('#'));
  const cleaned = lines.join('\n');

  // Split on top-level list items: lines starting with "- id:"
  const blocks = cleaned.split(/^- id:/m).slice(1);

  for (const block of blocks) {
    const get = (key: string): string => {
      const m = block.match(new RegExp(`^  ${key}:\\s*(.*)$`, 'm'));
      if (!m) return '';
      const v = m[1].trim();
      // strip surrounding quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1).replace(/\\"/g, '"');
      }
      return v;
    };

    const prereqRaw = get('prerequisites');
    let prerequisites: string[] = [];
    if (prereqRaw && prereqRaw !== '[]') {
      prerequisites = prereqRaw.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
    }

    const stageStr = get('stage');
    const stage = parseInt(stageStr, 10) || 0;

    items.push({
      id: block.split('\n')[0].trim(),
      title: get('title'),
      category: get('category'),
      stage,
      status: get('status') as RoadmapItem['status'],
      description: get('description'),
      prerequisites,
      jira: get('jira') || undefined,
      completed_at: get('completed_at') || undefined,
      commit_sha: get('commit_sha') || undefined,
      reject_reason: get('reject_reason') || undefined,
    });
  }

  return items;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<number, string> = {
  1: 'Stage 1 — POC 起步',
  2: 'Stage 2 — 基建拼装',
  3: 'Stage 3 — 多租户 + 起步工作流',
  4: 'Stage 4 — Canonical Scenarios MVP ⚡',
  5: 'Stage 5 — 生态变现',
  6: 'Stage 6 — 版本/快照系统',
  7: 'Stage 7 — AI 局部辅助',
  8: 'Stage 8+ — LLM 自治',
};

const STATUS_COLORS: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  blocked: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const STATUS_LABELS: Record<string, string> = {
  done: '✅ Done',
  in_progress: '🔵 In Progress',
  todo: '⬜ Todo',
  rejected: '🚫 Rejected',
  blocked: '🟡 Blocked',
};

const CATEGORIES = ['Auth', 'Tenancy', 'Workflow', 'Cases', 'Nodes', 'UI', 'Billing', 'Integrations', 'Ops', 'Stage8+'];
const STATUSES = ['done', 'in_progress', 'todo', 'rejected', 'blocked'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Roadmap() {
  const allItems = useMemo(() => parseRoadmapYaml(roadmapRaw), []);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [collapsedStages, setCollapsedStages] = useState<Set<number>>(new Set());

  // Stage summary stats
  const stageStats = useMemo(() => {
    const stats: Record<number, { total: number; done: number; in_progress: number }> = {};
    for (const item of allItems) {
      if (!stats[item.stage]) stats[item.stage] = { total: 0, done: 0, in_progress: 0 };
      stats[item.stage].total++;
      if (item.status === 'done') stats[item.stage].done++;
      if (item.status === 'in_progress') stats[item.stage].in_progress++;
    }
    return stats;
  }, [allItems]);

  // Filtered items
  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterStage && item.stage !== parseInt(filterStage)) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.jira || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allItems, filterStatus, filterStage, filterCategory, search]);

  // Group by stage
  const grouped = useMemo(() => {
    const g: Record<number, RoadmapItem[]> = {};
    for (const item of filtered) {
      if (!g[item.stage]) g[item.stage] = [];
      g[item.stage].push(item);
    }
    return g;
  }, [filtered]);

  const toggleStage = (stage: number) => {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterStage('');
    setFilterCategory('');
  };

  const hasFilters = search || filterStatus || filterStage || filterCategory;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <div className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← PeopleClaw
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-semibold">Roadmap</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {allItems.length} features
            </span>
          </div>
          <a
            href="/api/roadmap.csv"
            download="peopleclaw-roadmap.csv"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border rounded-md px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Stage Summary Cards ── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Stage Progress</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(stage => {
              const s = stageStats[stage] || { total: 0, done: 0, in_progress: 0 };
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              const isCurrent = stage === 4;
              return (
                <button
                  key={stage}
                  onClick={() => setFilterStage(filterStage === String(stage) ? '' : String(stage))}
                  className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${
                    filterStage === String(stage)
                      ? 'border-primary bg-primary/5'
                      : isCurrent
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-bold ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                      S{stage}{isCurrent ? ' ⚡' : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        pct === 100 ? 'bg-emerald-500' :
                        isCurrent ? 'bg-blue-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.done}/{s.total}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search features…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Stages</option>
            {[1,2,3,4,5,6,7,8].map(s => (
              <option key={s} value={s}>Stage {s}</option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear
            </button>
          )}

          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} of {allItems.length} features
          </span>
        </div>

        {/* ── Grouped Table ── */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No features match your filters.</div>
        ) : (
          <div className="space-y-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(stage => {
              const items = grouped[stage];
              if (!items || items.length === 0) return null;
              const isCollapsed = collapsedStages.has(stage);
              const s = stageStats[stage] || { total: 0, done: 0, in_progress: 0 };
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              const isCurrent = stage === 4;

              return (
                <div key={stage} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                  {/* Stage header */}
                  <button
                    onClick={() => toggleStage(stage)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`font-semibold ${isCurrent ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                        {STAGE_LABELS[stage] || `Stage ${stage}`}
                      </span>
                      {isCurrent && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{items.length} shown</span>
                      <span>{pct}% done ({s.done}/{s.total})</span>
                    </div>
                  </button>

                  {/* Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                            <th className="px-4 py-2.5 text-left font-medium w-24">ID</th>
                            <th className="px-4 py-2.5 text-left font-medium">Title</th>
                            <th className="px-4 py-2.5 text-left font-medium w-28">Status</th>
                            <th className="px-4 py-2.5 text-left font-medium w-28">Category</th>
                            <th className="px-4 py-2.5 text-left font-medium w-32">Prerequisites</th>
                            <th className="px-4 py-2.5 text-left font-medium w-32">Jira</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr
                              key={item.id}
                              className={`border-b last:border-0 transition-colors hover:bg-muted/20 ${
                                idx % 2 === 0 ? '' : 'bg-muted/5'
                              }`}
                            >
                              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                {item.id}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="font-medium leading-snug">{item.title}</div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {item.description}
                                  </div>
                                )}
                                {item.reject_reason && (
                                  <div className="text-xs text-red-500 mt-0.5 italic">{item.reject_reason}</div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] || ''}`}>
                                  {STATUS_LABELS[item.status] || item.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {item.category}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                                {item.prerequisites.length > 0
                                  ? item.prerequisites.slice(0, 3).join(', ') + (item.prerequisites.length > 3 ? '…' : '')
                                  : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-xs">
                                {item.jira ? (
                                  <a
                                    href={`https://rollersoft.atlassian.net/browse/${item.jira}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                  >
                                    {item.jira}
                                    <ExternalLink className="h-3 w-3 opacity-60" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="text-center text-xs text-muted-foreground pt-4 pb-8 border-t">
          PeopleClaw Roadmap · {allItems.length} features across 8 stages ·{' '}
          <a href="/api/roadmap.csv" className="underline hover:text-foreground">Download CSV</a>
        </div>
      </div>
    </div>
  );
}
