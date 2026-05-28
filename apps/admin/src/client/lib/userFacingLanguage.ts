const INTERNAL_APP_NAME_TERMS: Array<[RegExp, string]> = [
  [/\bAI\s+Canvas\s+Test\s+App\b/gi, 'AI Test App'],
  [/\bexported\s+component\b/gi, 'published app part'],
  [/\bComponent\b/gi, 'App part'],
  [/\bModule\b/gi, 'App area'],
  [/\bFULLSTACK\b/g, 'App'],
  [/\bFRONTEND\b/g, 'App'],
  [/\bBACKEND\b/g, 'App'],
  [/\bprobe\b/gi, 'check'],
  [/\bgraph\b/gi, 'map'],
  [/\bcanvas\b/gi, 'workspace'],
  [/\bworkflow\b/gi, 'automation'],
];

export function userFacingAppName(name: string): string {
  return INTERNAL_APP_NAME_TERMS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), name)
    .replace(/\s{2,}/g, ' ')
    .trim();
}
