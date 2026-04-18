import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enWorkflow from './locales/en/workflow.json';
import enCase from './locales/en/case.json';
import enCredits from './locales/en/credits.json';
import enSettings from './locales/en/settings.json';
import enDashboard from './locales/en/dashboard.json';
import enHome from './locales/en/home.json';

import zhCommon from './locales/zh/common.json';
import zhAuth from './locales/zh/auth.json';
import zhWorkflow from './locales/zh/workflow.json';
import zhCase from './locales/zh/case.json';
import zhCredits from './locales/zh/credits.json';
import zhSettings from './locales/zh/settings.json';
import zhDashboard from './locales/zh/dashboard.json';
import zhHome from './locales/zh/home.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        workflow: enWorkflow,
        case: enCase,
        credits: enCredits,
        settings: enSettings,
        dashboard: enDashboard,
        home: enHome,
      },
      zh: {
        common: zhCommon,
        auth: zhAuth,
        workflow: zhWorkflow,
        case: zhCase,
        credits: zhCredits,
        settings: zhSettings,
        dashboard: zhDashboard,
        home: zhHome,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh'],
    nonExplicitSupportedLngs: true, // 'zh-CN' → 'zh'
    defaultNS: 'common',
    ns: ['common', 'auth', 'workflow', 'case', 'credits', 'settings', 'dashboard', 'home'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'peopleclaw-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
