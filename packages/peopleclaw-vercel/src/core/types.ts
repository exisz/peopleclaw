/**
 * peopleclaw-vercel-broker — core types
 *
 * The broker holds the upstream Vercel token (server-side only) and issues
 * scoped customer tokens that allowlist a fixed set of repos / projects.
 * Customer tokens never see the upstream Vercel token.
 */

export type CustomerToken = {
  /** Opaque token id (visible in admin/audit, not the secret). */
  id: string;
  /** Human label, e.g. "skin-spirit-ci". */
  label: string;
  /** SHA-256 hex of the token secret. The plaintext is only returned once on issue. */
  secretHash: string;
  /** Allowed repo slugs (e.g. "exisz/skin-spirit-frontend"). Empty = none allowed. */
  allowedRepos: string[];
  /** Allowed Vercel project ids or names. Empty = none allowed. */
  allowedProjects: string[];
  /** Allowed Vercel team / account ids. Empty = no team scoping enforced beyond upstream token. */
  allowedTeams: string[];
  /** Optional ISO expiry; null = never expires. */
  expiresAt: string | null;
  createdAt: string;
  /** Last time token was used (audit). */
  lastUsedAt: string | null;
  /** Soft revoke. */
  revoked: boolean;
};

export type BrokerConfig = {
  /** Path to JSON token store (single file, mode 0600). */
  storePath: string;
  /** Admin secret for /admin/* endpoints. Bearer in Authorization header. */
  adminSecret: string;
  /** Upstream Vercel API token (server-only, never sent to customer). */
  vercelToken: string;
  /** Optional default Vercel team id for scoping requests. */
  vercelTeamId: string | null;
  /** Listening port. */
  port: number;
  /** Bind host (0.0.0.0 in container, 127.0.0.1 by default). */
  host: string;
  /** Public URL the broker is reachable at (used in token-issue responses). */
  publicUrl: string | null;
  /** Path to append-only audit log. */
  auditLogPath: string;
};

export const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Allowlisted upstream paths. Each entry is an exact path or a path-prefix
 * (ending with `/`). Matching is by `pathname` only — query strings are
 * forwarded as-is.
 *
 * The list is intentionally small and read-only-ish. Anything that can
 * mutate broker-wide state (account/team/membership) is excluded.
 *
 * Per-token allowlist is enforced AFTER the path passes this list.
 */
export const ALLOWED_UPSTREAM_PATHS: { method: string; pattern: string }[] = [
  // Auth & identity (no scoping, used by `whoami`)
  { method: 'GET', pattern: '/v2/user' },

  // Projects
  { method: 'GET', pattern: '/v9/projects' },
  { method: 'GET', pattern: '/v9/projects/' }, // /v9/projects/:idOrName
  { method: 'GET', pattern: '/v10/projects/' },

  // Deployments (read)
  { method: 'GET', pattern: '/v6/deployments' },
  { method: 'GET', pattern: '/v13/deployments/' }, // /v13/deployments/:id
  { method: 'GET', pattern: '/v6/deployments/' },

  // Deployment build logs / events / files (read)
  { method: 'GET', pattern: '/v3/deployments/' },
  { method: 'GET', pattern: '/v2/deployments/' },

  // Deployment trigger via Git (creates a new deploy from the linked Git repo;
  // requires repo allowlist match).
  { method: 'POST', pattern: '/v13/deployments' },

  // Domains (read-only)
  { method: 'GET', pattern: '/v5/domains' },
  { method: 'GET', pattern: '/v9/projects/' /* covers domains list under project too */ },

  // Logs (read)
  { method: 'GET', pattern: '/v2/projects/' },
];

export function isPathAllowed(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  for (const entry of ALLOWED_UPSTREAM_PATHS) {
    if (entry.method !== m) continue;
    if (entry.pattern.endsWith('/')) {
      if (pathname.startsWith(entry.pattern)) return true;
    } else if (entry.pattern === pathname) {
      return true;
    }
  }
  return false;
}
