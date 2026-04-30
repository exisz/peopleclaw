// PLANET-1408: image-storage stub — old implementation removed with workflow cleanup
// Re-implement when Stage 2 needs image uploads

export const imageStorage = {
  async upload(_file: { filename?: string; buffer: Buffer; contentType?: string; originalname?: string; mimetype?: string }): Promise<{ url: string; key: string }> {
    throw new Error('Image storage not configured (PLANET-1408 cleanup)');
  },
  async delete(_key: string) {
    // no-op
  },
};
