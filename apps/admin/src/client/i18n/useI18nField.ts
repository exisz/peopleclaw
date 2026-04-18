import { useTranslation } from 'react-i18next';

/**
 * Resolve a multi-language field: { en: '...', zh: '...' } | string → string for current language.
 * If field is a plain string, returned as-is. If object, picks current lang with English fallback.
 */
export function useI18nField(field: { en?: string; zh?: string } | string | undefined | null): string {
  const { i18n } = useTranslation();
  if (field == null) return '';
  if (typeof field === 'string') return field;
  const lang = (i18n.language || 'en').slice(0, 2) as 'en' | 'zh';
  return field[lang] ?? field.en ?? field.zh ?? '';
}
