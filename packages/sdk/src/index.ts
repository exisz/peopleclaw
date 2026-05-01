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
