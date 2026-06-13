import type { CustomerToken } from '../core/types.js';
import { isPathAllowed } from '../core/types.js';

export type AuthorizationDecision = { allowed: true } | { allowed: false; reason: string };

export function decideCustomerAccess(token: CustomerToken, method: string, upstreamPath: string, body?: unknown): AuthorizationDecision {
  const url = new URL(`https://api.vercel.com${upstreamPath}`);
  if (!isPathAllowed(method, url.pathname)) return deny('upstream path is not broker-allowlisted');
  if (method.toUpperCase() === 'GET' && url.pathname === '/v2/user') return { allowed: true };

  const allowedProjects = new Set(token.allowedProjects.map((value) => value.toLowerCase()));
  const allowedRepos = new Set(token.allowedRepos.map((value) => value.toLowerCase()));
  const allowedTeams = new Set(token.allowedTeams.map((value) => value.toLowerCase()));

  if (allowedProjects.size === 0 && allowedRepos.size === 0) return deny('customer token has empty project/repo allowlist');

  const teamId = firstQuery(url, ['teamId', 'team', 'slug']);
  if (teamId && allowedTeams.size > 0 && !allowedTeams.has(teamId.toLowerCase())) return deny('team is not allowlisted');

  const project = projectFromRequest(url, body);
  const repo = repoFromRequest(url, body);

  if (project && allowedProjects.has(project.toLowerCase())) return { allowed: true };
  if (repo && allowedRepos.has(repo.toLowerCase())) return { allowed: true };

  // List endpoints are permitted only for tokens with allowlists; responses are filtered downstream.
  if (method.toUpperCase() === 'GET' && (url.pathname === '/v9/projects' || url.pathname === '/v6/deployments')) {
    return { allowed: true };
  }

  return deny(`no allowlist match for project=${project ?? 'unknown'} repo=${repo ?? 'unknown'}`);
}

export function filterVercelResponse(token: CustomerToken, pathname: string, payload: unknown): unknown {
  if (pathname !== '/v9/projects' && pathname !== '/v6/deployments') return payload;
  const allowedProjects = new Set(token.allowedProjects.map((value) => value.toLowerCase()));
  const allowedRepos = new Set(token.allowedRepos.map((value) => value.toLowerCase()));

  if (pathname === '/v9/projects' && isObject(payload) && Array.isArray(payload.projects)) {
    return {
      ...payload,
      projects: payload.projects.filter((project) => {
        const p = project as Record<string, unknown>;
        const projectKeys = [p.id, p.name, p.slug].map((value) => String(value ?? '').toLowerCase());
        const repo = gitRepoSlug(p).toLowerCase();
        return projectKeys.some((key) => allowedProjects.has(key)) || (repo && allowedRepos.has(repo));
      }),
    };
  }

  if (pathname === '/v6/deployments' && isObject(payload) && Array.isArray(payload.deployments)) {
    return {
      ...payload,
      deployments: payload.deployments.filter((deployment) => {
        const d = deployment as Record<string, unknown>;
        const projectKeys = [d.projectId, d.name, d.project, d.projectName].map((value) => String(value ?? '').toLowerCase());
        const repo = gitRepoSlug(d).toLowerCase();
        return projectKeys.some((key) => allowedProjects.has(key)) || (repo && allowedRepos.has(repo));
      }),
    };
  }

  return payload;
}

function deny(reason: string): AuthorizationDecision {
  return { allowed: false, reason };
}

function firstQuery(url: URL, names: string[]): string | null {
  for (const name of names) {
    const value = url.searchParams.get(name);
    if (value) return value;
  }
  return null;
}

function projectFromRequest(url: URL, body: unknown): string | null {
  const queryProject = firstQuery(url, ['projectId', 'project', 'name']);
  if (queryProject) return queryProject;
  const parts = url.pathname.split('/').filter(Boolean);
  const projectsIndex = parts.indexOf('projects');
  if (projectsIndex >= 0 && parts[projectsIndex + 1]) return decodeURIComponent(parts[projectsIndex + 1]);
  const deploymentsIndex = parts.indexOf('deployments');
  if (deploymentsIndex >= 0 && parts[deploymentsIndex + 1] && parts.length === deploymentsIndex + 2) return decodeURIComponent(parts[deploymentsIndex + 1]);
  if (isObject(body)) {
    const candidate = body.projectId ?? body.project ?? body.name;
    if (candidate) return String(candidate);
  }
  return null;
}

function repoFromRequest(url: URL, body: unknown): string | null {
  const queryRepo = firstQuery(url, ['repo', 'repository', 'gitRepo']);
  if (queryRepo) return queryRepo;
  if (isObject(body)) {
    const gitSource = body.gitSource;
    if (isObject(gitSource)) {
      const repo = gitSource.repo ?? gitSource.repoId ?? gitSource.slug;
      const owner = gitSource.org ?? gitSource.owner ?? gitSource.ownerName;
      if (owner && repo) return `${owner}/${repo}`;
      if (repo) return String(repo);
    }
    const repo = body.repo ?? body.repository;
    if (repo) return String(repo);
  }
  return null;
}

function gitRepoSlug(record: Record<string, unknown>): string {
  const link = record.link;
  if (isObject(link)) {
    const repo = link.repo ?? link.repoSlug ?? link.name;
    const owner = link.org ?? link.owner ?? link.ownerName;
    if (owner && repo) return `${owner}/${repo}`;
    if (repo) return String(repo);
  }
  const meta = record.meta;
  if (isObject(meta)) {
    const repo = meta.githubRepo ?? meta.repo ?? meta.repoSlug;
    const owner = meta.githubOrg ?? meta.owner;
    if (owner && repo) return `${owner}/${repo}`;
    if (repo) return String(repo);
  }
  return '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
