export interface CliSecretReference {
  ref: string;
}

const SECRET_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function buildCliSecretReference(name: string): CliSecretReference {
  const ref = name.trim();
  if (!SECRET_NAME.test(ref)) {
    throw new Error('secret reference name must match [A-Za-z_][A-Za-z0-9_]{0,63}');
  }
  return { ref };
}

export function assertCliSecretPayloadDoesNotExposePlaintext(payload: unknown): void {
  const stack: unknown[] = [payload];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (/^(value|plaintext|secretValue|token|password)$/i.test(key)) {
        throw new Error(`CLI secret responses must not expose plaintext field: ${key}`);
      }
      stack.push(child);
    }
  }
}

export function formatCliSecretReferenceList(secretNames: string[]): CliSecretReference[] {
  return secretNames.map(buildCliSecretReference);
}
