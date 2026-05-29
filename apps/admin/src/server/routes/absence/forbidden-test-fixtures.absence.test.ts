import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

const roots = [join(process.cwd(), 'src/client'), join(process.cwd(), 'src/server')];
const forbidden = [
  'TODO Stage 3',
  'Published Apps',
  'AI 换脸',
  '公开此组件',
  '/workflows',
  'ReactFlow',
  'canvas',
  'Canvas',
  'workflow editor',
  'probe graph',
  'FULLSTACK',
  'FRONTEND',
  'BACKEND',
  'Component is not',
];

function listFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return [fullPath];
  });
}

describe('TC-PC-151 forbidden-string test fixture quarantine', () => {
  it('keeps client/server tests with forbidden literals in explicit absence regression paths', () => {
    const violations = roots
      .flatMap((root) => listFiles(root))
      .filter((file) => /(?:test|spec)\.tsx?$/.test(file))
      .filter((file) => !relative(process.cwd(), file).includes('absence'))
      .flatMap((file) => {
        const text = readFileSync(file, 'utf8');
        return forbidden
          .filter((needle) => text.includes(needle))
          .map((needle) => `${relative(process.cwd(), file)} contains ${JSON.stringify(needle)}`);
      });

    assert.deepEqual(violations, []);
  });
});
