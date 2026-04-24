/**
 * PLANET-1204: /api/roadmap.csv — no auth, public download
 */
import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const roadmapRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseYamlItems(raw: string): Record<string, unknown>[] {
  // Strip comment lines
  const lines = raw.split('\n').filter(l => !l.trimStart().startsWith('#'));
  const cleaned = lines.join('\n');
  const blocks = cleaned.split(/^- id:/m).slice(1);
  const items: Record<string, unknown>[] = [];

  for (const block of blocks) {
    const blockLines = block.split('\n');
    const id = blockLines[0].trim();

    const get = (key: string): string => {
      const m = block.match(new RegExp(`^  ${key}:\\s*(.*)$`, 'm'));
      if (!m) return '';
      const v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1).replace(/\\"/g, '"');
      }
      return v;
    };

    const prereqRaw = get('prerequisites');
    let prerequisites = '';
    if (prereqRaw && prereqRaw !== '[]') {
      prerequisites = prereqRaw.replace(/[\[\]]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean).join('|');
    }

    items.push({
      id,
      title: get('title'),
      category: get('category'),
      stage: get('stage'),
      status: get('status'),
      description: get('description'),
      prerequisites,
      jira: get('jira'),
      completed_at: get('completed_at'),
      commit_sha: get('commit_sha'),
      reject_reason: get('reject_reason'),
    });
  }

  return items;
}

function toCsv(items: Record<string, unknown>[]): string {
  const fields = ['id','title','category','stage','status','description','prerequisites','jira','completed_at','commit_sha','reject_reason'];
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const rows = [fields.join(',')];
  for (const item of items) {
    rows.push(fields.map(f => escape(item[f])).join(','));
  }
  return rows.join('\n') + '\n';
}

roadmapRouter.get('/roadmap.csv', (_req, res) => {
  try {
    // Try reading from data dir (relative to compiled output)
    const candidates = [
      join(__dirname, '../../data/roadmap.yaml'),       // api-dist/server/routes → api-dist/data
      join(__dirname, '../data/roadmap.yaml'),          // api-dist/data
      join(__dirname, '../../../src/data/roadmap.yaml'), // dev fallback
      join(process.cwd(), 'src/data/roadmap.yaml'),
      join(process.cwd(), 'apps/admin/src/data/roadmap.yaml'),
    ];

    let raw = '';
    for (const p of candidates) {
      try {
        raw = readFileSync(p, 'utf-8');
        break;
      } catch {
        // try next
      }
    }

    if (!raw) {
      res.status(503).json({ error: 'roadmap.yaml not found' });
      return;
    }

    const items = parseYamlItems(raw);
    const csv = toCsv(items);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="peopleclaw-roadmap.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
