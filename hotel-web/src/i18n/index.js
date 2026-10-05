/**
 * FAZ 1/#36 — i18n setup (TR varsayılan, EN manuel).
 *
 * - Varsayılan HER ZAMAN Türkçe. Tarayıcı dili ARTIK dikkate alınmıyor:
 *   İngilizce tarayıcılı kullanıcı karışık (yarı İngilizce) arayüz görmesin.
 *   İngilizce yalnızca kullanıcı dil seçiciden elle seçerse gelir
 *   (localStorage 'lang'). (Not: çeviriler eksik — sadece birkaç etiket.)
 * - Inline resources (küçük JSON, harici fetch yok)
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import tr from './locales/tr.json'
import en from './locales/en.json'

export const SUPPORTED_LANGS = [
  { code: 'tr', label: 'Türkçe',  flag: 'TR' },
  { code: 'en', label: 'English', flag: 'EN' },
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
      // Sadece localStorage — 'navigator' (tarayıcı dili) kasıtlı olarak YOK.
      // Kayıt yoksa fallbackLng (tr) devreye girer.
      order: ['localStorage'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
  })

export default i18n
