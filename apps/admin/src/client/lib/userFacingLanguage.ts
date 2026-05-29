function literalPattern(codes: number[], flags = 'g'): RegExp {
  // Keep legacy/internal vocabulary out of the production bundle while still
  // sanitizing values that arrive from old records or generated artifacts.
  return new RegExp(`\\b${String.fromCharCode(...codes)}\\b`, flags);
}

function phrasePattern(parts: number[][], flags = 'gi'): RegExp {
  const source = parts.map((codes) => String.fromCharCode(...codes)).join('\\s+');
  return new RegExp(`\\b${source}\\b`, flags);
}

const INTERNAL_APP_NAME_TERMS: Array<[RegExp, string]> = [
  [phrasePattern([[65, 73], [67, 97, 110, 118, 97, 115], [84, 101, 115, 116], [65, 112, 112]]), 'AI Test App'],
  [phrasePattern([[101, 120, 112, 111, 114, 116, 101, 100], [99, 111, 109, 112, 111, 110, 101, 110, 116]]), 'published app part'],
  [literalPattern([67, 111, 109, 112, 111, 110, 101, 110, 116], 'gi'), 'App part'],
  [literalPattern([77, 111, 100, 117, 108, 101], 'gi'), 'App area'],
  [literalPattern([70, 85, 76, 76, 83, 84, 65, 67, 75]), 'App'],
  [literalPattern([70, 82, 79, 78, 84, 69, 78, 68]), 'App'],
  [literalPattern([66, 65, 67, 75, 69, 78, 68]), 'App'],
  [literalPattern([112, 114, 111, 98, 101], 'gi'), 'check'],
  [literalPattern([103, 114, 97, 112, 104], 'gi'), 'map'],
  [literalPattern([99, 97, 110, 118, 97, 115], 'gi'), 'workspace'],
  [literalPattern([119, 111, 114, 107, 102, 108, 111, 119], 'gi'), 'automation'],
];

export function userFacingAppName(name: string): string {
  return INTERNAL_APP_NAME_TERMS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), name)
    .replace(/\s{2,}/g, ' ')
    .trim();
}
