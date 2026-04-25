/**
 * PLANET-1260 — Image upload route
 *
 * POST /api/upload-image — upload image file, store in CaseImage table, return URL
 * GET  /api/images/:id   — serve stored image by ID
 */
import { Router, type Response, type Request } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/tenant.js';
import crypto from 'crypto';

export const uploadRouter = Router();

// ── Helper: extract file from multipart raw body ─────────────────────────────
function extractFileFromRaw(
  body: Buffer,
  boundary: string,
): { filename: string; buffer: Buffer; contentType: string } | null {
  const sep = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(body, sep);
  for (const part of parts) {
    const str = part.toString('latin1');
    const headerEnd = str.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = str.slice(0, headerEnd);
    if (!headers.includes('filename=')) continue;
    const fnMatch = headers.match(/filename="([^"]+)"/);
    const filename = fnMatch ? fnMatch[1] : 'upload.png';
    const ctMatch = headers.match(/Content-Type:\s*(\S+)/i);
    const contentType = ctMatch ? ctMatch[1] : 'image/png';
    const contentStart = headerEnd + 4;
    const contentEnd = part.length - 2; // strip trailing \r\n
    const buffer = part.slice(contentStart, contentEnd);
    return { filename, buffer, contentType };
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

// ── GET /api/images/:id — serve stored image ─────────────────────────────────
uploadRouter.get('/images/:id', async (req: Request, res: Response) => {
  try {
    const { getPrisma } = await import('../lib/prisma.js');
    const prisma = getPrisma();
    // Use raw query since CaseImage isn't in Prisma schema
    const result = await (prisma as any).$queryRawUnsafe(
      'SELECT mimeType, data FROM CaseImage WHERE id = ?',
      req.params.id,
    );
    const row = (result as any[])?.[0];
    if (!row) { res.status(404).json({ error: 'not found' }); return; }
    const buf = Buffer.from(row.data, 'base64');
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buf);
  } catch (e) {
    console.error('[images] serve error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── POST /api/upload-image — auth required ───────────────────────────────────
uploadRouter.post(
  '/upload-image',
  requireAuth,
  requireTenant,
  (req, res: Response, next) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    req.on('data', (c: Buffer) => {
      totalSize += c.length;
      if (totalSize <= MAX_SIZE) chunks.push(c);
    });
    req.on('end', () => {
      if (totalSize > MAX_SIZE) {
        res.status(413).json({ error: 'File too large (max 5MB)' });
        return;
      }
      (req as unknown as { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
      next();
    });
  },
  async (req, res: Response) => {
    const r = req as unknown as { rawBody: Buffer };
    const contentType = req.headers['content-type'] ?? '';
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      res.status(400).json({ error: 'multipart/form-data with boundary required' });
      return;
    }

    const file = extractFileFromRaw(r.rawBody, boundaryMatch[1]);
    if (!file) {
      res.status(400).json({ error: 'No file found in upload' });
      return;
    }

    try {
      // Compress: resize to max 800px if image, using canvas is client-side only.
      // Just store the raw image for now (client already compresses).
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const b64 = file.buffer.toString('base64');

      const { getPrisma } = await import('../lib/prisma.js');
      const prisma = getPrisma();
      await (prisma as any).$executeRawUnsafe(
        'INSERT INTO CaseImage (id, mimeType, data) VALUES (?, ?, ?)',
        id,
        file.contentType,
        b64,
      );

      // Return a URL that can be used in the payload
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const url = `${baseUrl}/api/images/${id}`;
      res.json({ url });
    } catch (err) {
      console.error('[upload-image] error:', err);
      res.status(500).json({ error: 'Upload failed: ' + (err instanceof Error ? err.message : String(err)) });
    }
  },
);
