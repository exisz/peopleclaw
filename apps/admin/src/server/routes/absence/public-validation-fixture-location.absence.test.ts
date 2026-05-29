import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

function listFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(path, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

describe('TC-PC-156 public validation redaction fixture quarantine', () => {
  it('stores public validation forbidden-string regression fixtures only under explicit absence-test paths', () => {
    const root = join(process.cwd(), 'src/server/routes');
    const violations = listFiles(root)
      .filter((file) => /public-validation-redaction.*\.test\.ts$/.test(file))
      .map((file) => relative(process.cwd(), file))
      .filter((file) => !file.includes('absence'));

    assert.deepEqual(violations, []);
  });
});
