/**
 * Scan source for peopleClaw.nodeEntry('xxx') calls and return probe metadata.
 */

export interface ProbeResult {
  nodes: string[];
  order: string[];
}

export function distillProbes(source: string): ProbeResult {
  const regex = /peopleClaw\.nodeEntry\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const nodes: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    if (!nodes.includes(match[1])) {
      nodes.push(match[1]);
    }
  }
  return { nodes, order: nodes };
}
