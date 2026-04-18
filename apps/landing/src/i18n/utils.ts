import en from './en';
import zh from './zh';

export type Lang = 'en' | 'zh';

const dict: Record<Lang, unknown> = { en, zh };

export function getLang(url: URL): Lang {
  const seg = url.pathname.split('/')[1];
  return seg === 'zh' ? 'zh' : 'en';
}

/** Same path in the other language. Preserves trailing slash + query/hash. */
export function altLangPath(url: URL, target: Lang): string {
  const path = url.pathname;
  const search = url.search ?? '';
  const hash = url.hash ?? '';
  const stripped = path.startsWith('/zh/')
    ? path.slice(3) // remove leading "/zh"
    : path === '/zh'
    ? '/'
    : path;
  const out = target === 'zh'
    ? (stripped === '/' ? '/zh/' : `/zh${stripped}`)
    : stripped;
  return out + search + hash;
}

export function t(lang: Lang, key: string): string {
  const parts = key.split('.');
  let cur: unknown = dict[lang];
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
}
