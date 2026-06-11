/**
 * FAZ 1/#36 — i18n setup (TR varsayılan, EN destekli).
 *
 * - LanguageDetector: localStorage 'lang' → browser → fallback TR
 * - Inline resources (küçük JSON, harici fetch yok)
 * - Lazy add: yeni dil eklemek için sadece locales/xx.json + addResourceBundle
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import tr from './locales/tr.json'
import en from './locales/en.json'

export const SUPPORTED_LANGS = [
  { code: 'tr', label: 'Türkçe',  flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    fallbackLng: 'tr',
    supportedLngs: ['tr', 'en'],
    interpolation: { escapeValue: false },  // React zaten escape eder
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
  })

export default i18n
