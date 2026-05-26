export interface DataPlaybookCommandPolicyResult {
  ok: boolean;
  errors: string[];
}

const RAW_MIGRATION_PATTERNS = [
  /\bprisma\s+(?:migrate|db\s+push|db\s+execute)\b/i,
  /\b(?:drizzle-kit|knex|sequelize)\s+(?:migrate|push|up|down)\b/i,
  /\b(?:ALTER|CREATE|DROP|TRUNCATE)\s+(?:TABLE|INDEX|DATABASE)\b/i,
  /\bmigration\s*:/i,
];

/**
 * PeopleClaw schema changes are deployment playbooks, not arbitrary raw
 * migration commands. This guard rejects shell/SQL migration escape hatches
 * before a user App artifact can be planned or deployed.
 */
export function validateDataPlaybookCommand(command: string): DataPlaybookCommandPolicyResult {
  const normalized = command.trim();
  const errors: string[] = [];
  if (!normalized) errors.push('data playbook command is required');
  if (RAW_MIGRATION_PATTERNS.some(pattern => pattern.test(normalized))) {
    errors.push('data playbook must not include raw migration commands');
  }
  return { ok: errors.length === 0, errors };
}
