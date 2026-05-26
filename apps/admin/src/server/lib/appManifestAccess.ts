import { createScopedAppNotFoundBody, type ScopedNotFoundBody } from './scopedNotFound.js';

export interface TenantScopedAppManifestRecord<TManifest = unknown> {
  appId: string;
  tenantId: string;
  manifest: TManifest;
}

export type TenantScopedManifestAccessResult<TManifest = unknown> =
  | { ok: true; appId: string; tenantId: string; manifest: TManifest }
  | { ok: false; status: 404; body: ScopedNotFoundBody };

/**
 * Resolve a deployment manifest only after tenant ownership is proven. Cross-tenant
 * lookups intentionally return the same scoped 404 shape as unknown apps so tenant
 * A cannot infer or read tenant B's manifest.
 */
export function readTenantScopedAppManifest<TManifest>(input: {
  requestingTenantId: string;
  appId: string;
  records: TenantScopedAppManifestRecord<TManifest>[];
}): TenantScopedManifestAccessResult<TManifest> {
  const record = input.records.find(candidate => candidate.appId === input.appId && candidate.tenantId === input.requestingTenantId);
  if (!record) {
    return { ok: false, status: 404, body: createScopedAppNotFoundBody() };
  }

  return {
    ok: true,
    appId: record.appId,
    tenantId: record.tenantId,
    manifest: record.manifest,
  };
}
