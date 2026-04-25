/**
 * PLANET-1260 — Image upload route
 *
 * POST /api/upload-image — upload image file, store in Vercel Blob, return URL
 */
import { Router, type Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/tenant.js';

export const uploadRouter = Router();
uploadRouter.use(requireAuth, requireTenant);

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

// ── POST /api/upload-image ───────────────────────────────────────────────────
uploadRouter.post(
  '/upload-image',
  (req, res: Response, next) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    req.on('data', (c: Buffer) => {
      totalSize += c.length;
      if (totalSize <= MAX_SIZE) chunks.push(c);
    });
    req.on('end', () => {
      if (totalSize > MAX_SIZE) {
        res.status(413).json({ error: 'File too large (max 10MB)' });
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
      const { put } = await import('@vercel/blob');
      const ext = file.filename.split('.').pop() || 'png';
      const blobName = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const uploaded = await put(blobName, file.buffer, {
        access: 'public',
        contentType: file.contentType,
      });
      res.json({ url: uploaded.url });
    } catch (err) {
      console.error('[upload-image] Vercel Blob error:', err);
      res.status(500).json({ error: 'Upload failed: ' + (err instanceof Error ? err.message : String(err)) });
    }
  },
);
