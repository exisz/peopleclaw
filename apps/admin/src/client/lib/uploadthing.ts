/**
 * PLANET-1260 — UploadThing client helpers
 *
 * Provides typed React hooks for the UploadThing file router.
 * Type-only import from server — erased at compile time, no server code bundled.
 */
import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '../../server/routes/upload';

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>({
  url: '/api/uploadthing',
});
