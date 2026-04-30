import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enCredits from './locales/en/credits.json';
import enSettings from './locales/en/settings.json';
import enHome from './locales/en/home.json';

import zhCommon from './locales/zh/common.json';
import zhAuth from './locales/zh/auth.json';
import zhCredits from './locales/zh/credits.json';
import zhSettings from './locales/zh/settings.json';
import zhHome from './locales/zh/home.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        credits: enCredits,
        settings: enSettings,
        home: enHome,
      },
      zh: {
        common: zhCommon,
        auth: zhAuth,
        credits: zhCredits,
        settings: zhSettings,
        home: zhHome,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh'],
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    ns: ['common', 'auth', 'credits', 'settings', 'home'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'peopleclaw-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
