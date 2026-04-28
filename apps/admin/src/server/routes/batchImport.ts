/**
 * PLANET-1196 — Batch Import routes
 *
 * POST /api/batch-import          — upload xlsx/csv, fan-out N cases
 * GET  /api/batch-import/:batchId — batch summary (progress)
 * POST /api/cases/:id/fix-field   — patch a field on awaiting_fix case + re-validate
 * POST /api/batch-import/:batchId/reupload — re-upload table, patch only awaiting_fix rows
 */
import { Router, type Request as ExpressRequest, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { parseTableBuffer } from '../lib/tableParser.js';
import { advanceCase } from '../engine/executor.js';
import { nanoid } from 'nanoid';

export const batchImportRouter = Router();
batchImportRouter.use(requireAuth, requireTenant);

// ── Helper: parse multipart/form-data buffer from raw body ───────────────────
// We use express.raw() instead of multer to keep deps minimal.
function extractFileFromRaw(
  body: Buffer,
  boundary: string,
): { filename: string; buffer: Buffer } | null {
  // Very minimal multipart parser — just extract the first file part
  const sep = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(body, sep);
  for (const part of parts) {
    const str = part.toString('latin1');
    const headerEnd = str.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = str.slice(0, headerEnd);
    if (!headers.includes('filename=')) continue;
    const fnMatch = headers.match(/filename="([^"]+)"/);
    const filename = fnMatch ? fnMatch[1] : 'upload.xlsx';
    // content starts after the double CRLF, strip trailing CRLF
    const contentStart = headerEnd + 4;
    const contentEnd = part.length - 2; // strip trailing \r\n before boundary
    const buffer = part.slice(contentStart, contentEnd);
    return { filename, buffer };
  }
  return null;
}

function splitBuffer(buf: Buffer, sep: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  while (true) {
    const idx = buf.indexOf(sep, start);
    if (idx === -1) break;
    if (idx > start) parts.push(buf.slice(start, idx));
    start = idx + sep.length;
  }
  if (start < buf.length) parts.push(buf.slice(start));
  return parts;
}

// ── POST /api/batch-import ───────────────────────────────────────────────────
// Content-Type: multipart/form-data with file field "file" and "workflowId"
batchImportRouter.post(
  '/batch-import',
  (req, res: Response, next) => {
    // Collect raw body (max 1MB as per spec)
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      (req as unknown as ExpressRequest & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
      next();
    });
  },
  async (req, res: Response) => {
    const r = req as unknown as TenantedRequest & { rawBody: Buffer };
    const contentType = req.headers['content-type'] ?? '';
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      res.status(400).json({ error: 'multipart/form-data with boundary required' });
      return;
    }

    const extracted = extractFileFromRaw(r.rawBody, boundaryMatch[1]);
    if (!extracted) {
      res.status(400).json({ error: 'No file found in upload' });
      return;
    }
    const { filename, buffer } = extracted;

    // Extract workflowId from form-data text part
    const rawStr = r.rawBody.toString('latin1');
    // Fix: use [^\r\n]+ (not [^\r\n--]+ which incorrectly excludes hyphens via range)
    const wfMatch = rawStr.match(/name="workflowId"\r\n\r\n([^\r\n]+)/);
    const workflowId = wfMatch ? wfMatch[1].trim() : null;
    if (!workflowId) {
      res.status(400).json({ error: 'workflowId required' });
      return;
    }

    // Validate file extension
    if (!filename.match(/\.(xlsx|csv)$/i)) {
      res.status(400).json({ error: 'Only .xlsx and .csv files accepted' });
      return;
    }
    // Hard size limit: 1MB
    if (buffer.length > 1024 * 1024) {
      res.status(400).json({ error: 'File exceeds 1MB limit' });
      return;
    }

    const prisma = getPrisma();

    const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!wf) { res.status(404).json({ error: 'workflow not found' }); return; }
    if (wf.tenantId && wf.tenantId !== r.tenant.id) {
      res.status(403).json({ error: 'workflow belongs to another tenant' });
      return;
    }

    // Parse the file
    let parseResult;
    try {
      parseResult = parseTableBuffer(buffer, filename);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: `Parse error: ${msg}` });
      return;
    }

    const { ok_rows, error_rows, unmapped_columns } = parseResult;
    console.log('[batch-import] parse result', {
      ok: ok_rows.length,
      errors: error_rows.length,
      unmapped: unmapped_columns,
      firstOk: ok_rows[0],
      firstErr: error_rows[0],
    });
    if (ok_rows.length === 0 && error_rows.length === 0) {
      res.status(400).json({ error: '文件无有效数据行' });
      return;
    }

    // Generate batch_id
    const batchId = `batch-${new Date().toISOString().slice(0, 10)}-${nanoid(6)}`;
    const createdCases: Array<{ id: string; status: string; row: number }> = [];
    const caseIdsToAdvance: string[] = [];

    // Fan-out: ok_rows → running cases
    for (const row of ok_rows) {
      const c = await prisma.case.create({
        data: {
          workflowId,
          ownerId: r.user.id,
          tenantId: r.tenant.id,
          title: `[批次] ${row.product_name} (行${row.row})`,
          batchId,
          status: 'running',
          payload: JSON.stringify({
            product_name: row.product_name,
            price: row.price,
            stock: row.stock,
            ...(row.image_url ? { image_url: row.image_url } : {}),
            ...(row.sku ? { sku: row.sku } : {}),
            ...(row.description ? { description: row.description } : {}),
            ...(row.category ? { category: row.category } : {}),
            // PLANET-1345: parse color string into color_variants
            // Supports: "白色/绿色" or "白色:128/绿色:118" (color:price format)
            // Stock is evenly distributed from total row.stock
            ...(row.color ? (() => {
              const colors = row.color
                .split(/[/\/,、，]+/)
                .map(c => c.trim())
                .filter(Boolean);
              const stockEach = colors.length > 0 ? Math.floor(row.stock / colors.length) : row.stock;
              return {
                color_variants: colors.map(c => {
                  const parts = c.split(/[:：]/);
                  const color = parts[0]?.trim() || c;
                  const price = parts[1] ? Number(parts[1].trim()) || 0 : 0;
                  return { color, stock: stockEach, price };
                }),
              };
            })() : {}),
            batch_id: batchId,
            batch_row: row.row,
          }),
        },
      });
      createdCases.push({ id: c.id, status: 'running', row: row.row });
      caseIdsToAdvance.push(c.id);
    }

    // Fan-out: error_rows → awaiting_fix cases
    for (const row of error_rows) {
      const c = await prisma.case.create({
        data: {
          workflowId,
          ownerId: r.user.id,
          tenantId: r.tenant.id,
          title: `[批次·待修] 行${row.row} ${row.column}错误`,
          batchId,
          status: 'awaiting_fix',
          payload: JSON.stringify({
            batch_id: batchId,
            batch_row: row.row,
            _error: { column: row.column, value: row.value, reason: row.reason },
          }),
        },
      });
      createdCases.push({ id: c.id, status: 'awaiting_fix', row: row.row });
    }

    // Await all case advances concurrently BEFORE responding
    // (Vercel serverless terminates after response; fire-and-forget is unreliable)
    await Promise.all(
      caseIdsToAdvance.map((id) =>
        advanceCase(id).catch((e) =>
          console.error(`[batch-import] advanceCase ${id} failed:`, e),
        ),
      ),
    );

    res.json({
      batchId,
      ok_count: ok_rows.length,
      error_count: error_rows.length,
      unmapped_columns,
      cases: createdCases,
    });
  },
);

// ── GET /api/batch-import/:batchId ───────────────────────────────────────────
batchImportRouter.get('/batch-import/:batchId', async (req, res: Response) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const cases = await prisma.case.findMany({
    where: { batchId: req.params.batchId, tenantId: r.tenant.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, title: true, status: true, batchId: true,
      currentStepId: true, payload: true, createdAt: true, updatedAt: true,
    },
  });
  if (cases.length === 0) {
    res.status(404).json({ error: 'batch not found' });
    return;
  }
  const done = cases.filter((c) => c.status === 'done').length;
  const total = cases.length;
  res.json({ batchId: req.params.batchId, total, done, cases });
});

// ── POST /api/cases/:id/fix-field ────────────────────────────────────────────
// Patch one or more fields on an awaiting_fix case, re-validate, then advance if ok.
batchImportRouter.post('/cases/:id/fix-field', async (req, res: Response) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  if (c.status !== 'awaiting_fix') {
    res.status(400).json({ error: 'Case is not in awaiting_fix status' });
    return;
  }

  const { fields } = req.body ?? {};
  if (!fields || typeof fields !== 'object') {
    res.status(400).json({ error: 'fields object required' });
    return;
  }

  const currentPayload = JSON.parse(c.payload || '{}');
  const merged = { ...currentPayload, ...fields };

  // Inline re-validation
  const { z } = await import('zod');
  const rowSchema = z.object({
    product_name: z.string().min(1).max(200),
    price: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().min(0)),
    stock: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().int().min(0)),
    image_url: z.string().optional().transform((v) => v === '' ? undefined : v).pipe(z.string().url().optional()),
  });

  const result = rowSchema.safeParse(merged);
  if (!result.success) {
    const issue = result.error.issues[0];
    res.status(400).json({ error: issue.message, column: issue.path[0] });
    return;
  }

  // Update payload and set status to running, clear error
  const newPayload = { ...merged, _error: undefined };
  await prisma.case.update({
    where: { id: c.id },
    data: { payload: JSON.stringify(newPayload), status: 'running' },
  });

  // Advance the case
  try {
    const advResult = await advanceCase(c.id);
    const fresh = await prisma.case.findUnique({ where: { id: c.id } });
    res.json({ case: fresh, result: advResult });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/batch-import/:batchId/reupload ─────────────────────────────────
// Re-upload a corrected table; only updates cases still in awaiting_fix.
batchImportRouter.post(
  '/batch-import/:batchId/reupload',
  (req, res: Response, next) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      (req as unknown as ExpressRequest & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
      next();
    });
  },
  async (req, res: Response) => {
    const r = req as unknown as TenantedRequest & { rawBody: Buffer };
    const { batchId } = req.params;
    const prisma = getPrisma();

    // Find awaiting_fix cases in this batch
    const pendingCases = await prisma.case.findMany({
      where: { batchId, tenantId: r.tenant.id, status: 'awaiting_fix' },
    });
    if (pendingCases.length === 0) {
      res.json({ updated: 0, message: '没有待修复的行' });
      return;
    }

    const contentType = req.headers['content-type'] ?? '';
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) { res.status(400).json({ error: 'multipart required' }); return; }

    const extracted = extractFileFromRaw(r.rawBody, boundaryMatch[1]);
    if (!extracted) { res.status(400).json({ error: 'No file found' }); return; }
    const { filename, buffer } = extracted;
    if (!filename.match(/\.(xlsx|csv)$/i)) {
      res.status(400).json({ error: 'Only .xlsx and .csv files accepted' });
      return;
    }

    let parseResult;
    try {
      parseResult = parseTableBuffer(buffer, filename);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
      return;
    }

    const { ok_rows } = parseResult;
    const updated: string[] = [];
    const stillFailing: Array<{ row: number; reason: string }> = [];

    for (const pending of pendingCases) {
      const pendingPayload = JSON.parse(pending.payload || '{}');
      const batchRow: number = pendingPayload.batch_row ?? -1;
      const matchedRow = ok_rows.find((r) => r.row === batchRow);
      if (matchedRow) {
        const newPayload = {
          ...pendingPayload,
          product_name: matchedRow.product_name,
          price: matchedRow.price,
          stock: matchedRow.stock,
          ...(matchedRow.image_url ? { image_url: matchedRow.image_url } : {}),
          _error: undefined,
        };
        await prisma.case.update({
          where: { id: pending.id },
          data: { payload: JSON.stringify(newPayload), status: 'running' },
        });
        updated.push(pending.id);
        advanceCase(pending.id).catch((e) =>
          console.error(`[batch-reupload] advanceCase ${pending.id} failed:`, e),
        );
      } else {
        stillFailing.push({ row: batchRow, reason: '重传表中仍有错误或行号不匹配' });
      }
    }

    res.json({ updated: updated.length, stillFailing, updatedCaseIds: updated });
  },
);
