export type { ProgressEvent, ResultEvent, ErrorEvent, SSEEvent } from './types';

export interface PeopleClawRuntime {
  step(name: string): Promise<void>;
}

class PeopleClawInstance implements PeopleClawRuntime {
  async step(name: string): Promise<void> {
    console.log(`[peopleclaw:step] ${name} @ ${Date.now()}`);
  }
}

export const peopleClaw: PeopleClawRuntime = new PeopleClawInstance();

// Fullstack component definition
export interface FullstackDefinition {
  server: (ctx: any) => Promise<any>;
  Client: (props: { data: any; refresh: () => void }) => any;
  _kind: 'fullstack';
}

export function defineFullstack(opts: { server: (ctx: any) => Promise<any>; Client: (props: any) => any }): FullstackDefinition {
  return { ...opts, _kind: 'fullstack' };
}

export type { AppArtifactTree, AppManifest, AppManifestRoute, AppSidebar, AppSidebarSection, AppSidebarItem, ArtifactValidationResult } from './app-artifact';
export { validateAppArtifactTree, assertValidAppArtifactTree } from './app-artifact';
