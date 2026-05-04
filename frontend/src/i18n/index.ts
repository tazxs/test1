import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import kk from './locales/kk.json'
import ru from './locales/ru.json'

export const LANGUAGE_STORAGE_KEY = 'nalogai.language'
export const SUPPORTED_LANGUAGES = ['ru', 'kk', 'en'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_OPTIONS: { code: SupportedLanguage; shortLabel: string; label: string; intlLocale: string }[] = [
  { code: 'ru', shortLabel: 'RU', label: 'Русский', intlLocale: 'ru-KZ' },
  { code: 'kk', shortLabel: 'ҚАЗ', label: 'Қазақша', intlLocale: 'kk-KZ' },
  { code: 'en', shortLabel: 'EN', label: 'English', intlLocale: 'en-US' },
]

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
}

function getStoredLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isSupportedLanguage(stored) ? stored : null
}

function getBrowserLanguage(): SupportedLanguage | null {
  if (typeof navigator === 'undefined') return null
  const candidates = [navigator.language, ...navigator.languages].map((lang) => lang.split('-')[0])
  return candidates.find(isSupportedLanguage) ?? null
}

export function getInitialLanguage(): SupportedLanguage {
  return getStoredLanguage() ?? getBrowserLanguage() ?? 'ru'
}

export function getCurrentLanguage(): SupportedLanguage {
  const current = i18n.resolvedLanguage ?? i18n.language
  const base = current.split('-')[0]
  return isSupportedLanguage(base) ? base : 'ru'
}

export function getIntlLocale(language = getCurrentLanguage()): string {
  return LANGUAGE_OPTIONS.find((option) => option.code === language)?.intlLocale ?? 'ru-KZ'
}

export function hasStoredLanguagePreference(): boolean {
  return getStoredLanguage() != null
}

export async function setLanguage(language: SupportedLanguage) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  await i18n.changeLanguage(language)
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      kk: { translation: kk },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'ru',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })
  .catch((error) => {
    console.error('Failed to initialize i18n:', error)
  })

export default i18n
