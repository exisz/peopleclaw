// PLANET-1408: minimal image storage adapter retained for upload route compatibility.
import { randomUUID } from 'node:crypto';

export interface StoredImage {
  url: string;
  key: string;
}

export const imageStorage = {
  async upload(file: { filename: string; buffer: Buffer; contentType: string }): Promise<StoredImage> {
    const key = `${randomUUID()}-${file.filename}`;
    // UploadThing is the production path; this fallback keeps the legacy direct
    // upload API buildable without reintroducing visual-builder internals.
    return { key, url: `data:${file.contentType};base64,${file.buffer.toString('base64')}` };
  },
  async delete(_key: string): Promise<void> {
    return;
  },
};
