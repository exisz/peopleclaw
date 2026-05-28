import { test, expect } from '@playwright/test';

const forbiddenNeedles = [
  'TODO Stage 3',
  'Published Apps',
  'AI 换脸',
  '公开此组件',
  '/workflows',
  'ReactFlow',
  'workflow editor',
  'probe graph',
  'FULLSTACK',
  'FRONTEND',
  'BACKEND',
  'Component is not',
  'exported component',
  'component controls',
  'no-code',
  'No-code',
];

function normalizeCssReset(text: string) {
  // Vite/Tailwind's browser reset legitimately contains the HTML element selector
  // `video,canvas,audio`; this is not a user-facing canvas/workflow product surface.
  return text.replace(/img,svg,video,canvas,audio,iframe,embed,object\{[^}]+\}/g, '');
}

function findForbidden(sourceName: string, text: string) {
  const normalized = sourceName.endsWith('.css') ? normalizeCssReset(text) : text;
  const needles = sourceName.endsWith('.css')
    ? forbiddenNeedles.concat(['Canvas'])
    : forbiddenNeedles.concat(['canvas', 'Canvas']);

  return needles
    .filter((needle) => normalized.includes(needle))
    .map((needle) => `${sourceName}: ${needle}`);
}

test('prod-health: production bundle has no legacy workflow/canvas/component strings', async ({ request, baseURL }) => {
  expect(baseURL, 'legacy bundle scan must target the production app host').toContain(
    'app.peopleclaw.rollersoft.com.au',
  );

  const index = await request.get('/');
  expect(index.ok(), `GET / returned HTTP ${index.status()}`).toBeTruthy();
  const html = await index.text();
  const assetPaths = Array.from(html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g), (match) => match[1]);
  expect(assetPaths, 'production index must reference built JS/CSS assets').not.toHaveLength(0);

  const violations = findForbidden('index.html', html);
  for (const assetPath of [...new Set(assetPaths)].sort()) {
    const asset = await request.get(`/${assetPath}`);
    expect(asset.ok(), `GET /${assetPath} returned HTTP ${asset.status()}`).toBeTruthy();
    violations.push(...findForbidden(assetPath, await asset.text()));
  }

  expect(violations, `Forbidden legacy bundle strings found:\n${violations.join('\n')}`).toEqual([]);
});
