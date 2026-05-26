export interface ScreenBundleManifestEntry {
  screen: string;
  artifactHash: string;
  bundleUrl: string;
}

export interface ScreenBundleLoadRequest {
  screen: string;
  artifactHash: string;
  bundleUrl: string;
}

export function resolveScreenBundleByHash(
  screen: string,
  artifactHash: string,
  manifest: Record<string, ScreenBundleManifestEntry>,
): ScreenBundleLoadRequest {
  const entry = manifest[artifactHash];
  if (!entry || entry.screen !== screen || entry.artifactHash !== artifactHash) {
    throw new Error(`No immutable screen bundle found for ${screen} at ${artifactHash}`);
  }
  return { screen: entry.screen, artifactHash: entry.artifactHash, bundleUrl: entry.bundleUrl };
}
