export type { ProbeEvent, ResultEvent, ErrorEvent, SSEEvent } from './types';

export interface PeopleClawProbe {
  nodeEntry(node: string): Promise<void>;
}

class PeopleClawInstance implements PeopleClawProbe {
  async nodeEntry(node: string): Promise<void> {
    // Standalone probe — logs for now, future: report to collector
    console.log(`[peopleclaw:probe] enter ${node} @ ${Date.now()}`);
  }
}

export const peopleClaw: PeopleClawProbe = new PeopleClawInstance();

// Fullstack component definition
export interface FullstackDefinition {
  server: (ctx: any) => Promise<any>;
  Client: (props: { data: any; refresh: () => void }) => any;
  _kind: 'fullstack';
}

export function defineFullstack(opts: { server: (ctx: any) => Promise<any>; Client: (props: any) => any }): FullstackDefinition {
  return { ...opts, _kind: 'fullstack' };
}
