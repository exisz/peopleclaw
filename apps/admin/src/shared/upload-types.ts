/**
 * PLANET-1260 — Shared upload types (server ↔ client)
 *
 * The file router type is defined here so the client can import it
 * without pulling in server-only code.
 */
import type { createUploadthing } from 'uploadthing/express';

// Re-export the router type — actual router lives in server/routes/upload.ts
// This file exists so the client can do a type-only import.
export type { OurFileRouter } from '../server/routes/upload.js';
