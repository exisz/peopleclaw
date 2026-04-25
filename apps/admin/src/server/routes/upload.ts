/**
 * PLANET-1260 — Image upload routes + UploadThing route handler
 *
 * POST /api/upload-image  — multipart upload via imageStorage abstraction
 * DELETE /api/images/:key — delete image from storage provider
 * /api/uploadthing/*      — UploadThing React component route handler
 *
 * Legacy GET /api/images/:id route removed — UploadThing serves CDN URLs directly.
 */
import { Router, type Response, type Request } from 'express';
import { createUploadthing, createRouteHandler } from 'uploadthing/express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/tenant.js';
import { imageStorage } from '../lib/image-storage.js';

export const uploadRouter = Router();

// ── UploadThing file router (for React component uploads) ────────────────────
const f = createUploadthing();

const utRouter = {
  imageUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .onUploadComplete(({ file }) => {
      return { url: file.ufsUrl };
    }),
};

/** Export type for client-side generateReactHelpers */
export type OurFileRouter = typeof utRouter;

// Mount UploadThing handler — createRouteHandler returns an Express Router
export const uploadThingHandler = createRouteHandler({ router: utRouter });

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

// ── DELETE /api/images/:key — delete from storage provider ───────────────────
uploadRouter.delete('/images/:key', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    await imageStorage.delete(req.params.key);
    res.json({ ok: true });
  } catch (e) {
    console.error('[images] delete error:', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ── POST /api/upload-image — multipart upload via imageStorage ───────────────
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
      const result = await imageStorage.upload(file);
      res.json({ url: result.url, key: result.key });
    } catch (err) {
      console.error('[upload-image] error:', err);
      res.status(500).json({
        error: 'Upload failed: ' + (err instanceof Error ? err.message : String(err)),
      });
    }
  },
);
