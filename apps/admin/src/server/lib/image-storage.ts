/**
 * PLANET-1260 — Modular image storage abstraction
 *
 * Swap providers by setting IMAGE_STORAGE_PROVIDER env var.
 * Default: "uploadthing"
 */
import { UTApi } from 'uploadthing/server';

// ── Interface ────────────────────────────────────────────────────────────────
export interface ImageStorageProvider {
  upload(file: {
    buffer: Buffer;
    filename: string;
    contentType: string;
  }): Promise<{ url: string; key: string }>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

// ── UploadThing provider ─────────────────────────────────────────────────────
class UploadThingStorageProvider implements ImageStorageProvider {
  private utapi: UTApi;

  constructor() {
    // UTApi reads UPLOADTHING_TOKEN from env automatically
    this.utapi = new UTApi();
  }

  async upload(file: {
    buffer: Buffer;
    filename: string;
    contentType: string;
  }): Promise<{ url: string; key: string }> {
    // UTApi.uploadFiles accepts File-like objects
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.contentType });
    const uploadFile = new File([blob], file.filename, { type: file.contentType });

    const res = await this.utapi.uploadFiles(uploadFile);
    if (res.error) {
      throw new Error(`UploadThing upload failed: ${res.error.message}`);
    }
    return {
      url: res.data.ufsUrl,
      key: res.data.key,
    };
  }

  async delete(key: string): Promise<void> {
    await this.utapi.deleteFiles(key);
  }

  getUrl(key: string): string {
    // UploadThing CDN URL pattern
    return `https://utfs.io/f/${key}`;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────
function createProvider(): ImageStorageProvider {
  const provider = process.env.IMAGE_STORAGE_PROVIDER || 'uploadthing';
  switch (provider) {
    case 'uploadthing':
      return new UploadThingStorageProvider();
    default:
      throw new Error(`Unknown image storage provider: ${provider}`);
  }
}

/** Singleton image storage — import this everywhere */
export const imageStorage: ImageStorageProvider = createProvider();
