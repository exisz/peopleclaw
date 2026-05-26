export interface ScreenImportPolicyResult {
  ok: boolean;
  errors: string[];
}

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+['"]@peopleclaw\/admin(?:\/|['"])/,
  /from\s+['"]@peopleclaw\/server(?:\/|['"])/,
  /from\s+['"]\.\.\/(?:server|middleware|generated|lib\/prisma)(?:\/|['"])/,
  /from\s+['"]\.\.\/\.\.\/(?:server|middleware|generated|lib\/prisma)(?:\/|['"])/,
];

export function validateScreenImports(source: string): ScreenImportPolicyResult {
  const errors: string[] = [];
  for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
    if (pattern.test(source)) {
      errors.push('screen source must not import PeopleClaw platform internals');
      break;
    }
  }
  return { ok: errors.length === 0, errors };
}
