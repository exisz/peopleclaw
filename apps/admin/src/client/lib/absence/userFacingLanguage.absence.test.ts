import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { userFacingAppName } from '../userFacingLanguage';

const userFacingSourceRoots = [
  join(process.cwd(), 'src/client/components'),
  join(process.cwd(), 'src/client/pages'),
  join(process.cwd(), 'src/client/i18n'),
  join(process.cwd(), 'src/client/index.html'),
];

const forbiddenComponentTypeLabels = [/\bFULLSTACK\b/, /\bFRONTEND\b/, /\bBACKEND\b/];
const forbiddenCanvasLabels = [/\bCanvas\b/, /\bcanvas\b/];

function listUserFacingSourceFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return /\.(tsx?|json|html)$/.test(path) ? [path] : [];

  const entries = readdirSync(path, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) return listUserFacingSourceFiles(fullPath);
    if (!/\.(tsx?|json|html)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

function scanForbiddenLabels(patterns: RegExp[]) {
  return userFacingSourceRoots
    .flatMap((root) => listUserFacingSourceFiles(root))
    .flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return patterns
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${relative(process.cwd(), file)}: ${pattern}`);
    });
}

const forbidden = [
  /\bComponent\b/i,
  /\bModule\b/i,
  /\bFULLSTACK\b/,
  /\bFRONTEND\b/,
  /\bBACKEND\b/,
  /exported component/i,
  /\bprobe\b/i,
  /\bgraph\b/i,
  /\bcanvas\b/i,
  /\bworkflow\b/i,
];

describe('TC-PC-124 user-facing app language', () => {
  it('hides internal app-building terms from non-technical app names', () => {
    const visible = userFacingAppName('AI Canvas Test App Component Module FULLSTACK FRONTEND BACKEND exported component probe graph workflow');
    const violations = forbidden.filter(pattern => pattern.test(visible)).map(String);

    assert.deepEqual(violations, []);
    assert.equal(visible.includes('App'), true);
  });
});

describe('TC-PC-133 client source user-facing component type language', () => {
  it('keeps FULLSTACK/FRONTEND/BACKEND out of rendered client surfaces and locale copy', () => {
    assert.deepEqual(scanForbiddenLabels(forbiddenComponentTypeLabels), []);
  });
});


describe('TC-PC-134 client source user-facing canvas language', () => {
  it('keeps Canvas/canvas product-surface labels out of rendered client surfaces and locale copy', () => {
    assert.deepEqual(scanForbiddenLabels(forbiddenCanvasLabels), []);
  });
});
