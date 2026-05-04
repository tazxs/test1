export type SupportedLanguage = 'kk' | 'ru' | 'en'

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ru'

const KAZAKH_CHARS = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/
const CYRILLIC_CHARS = /[а-яёА-ЯЁ]/
const LATIN_WORDS = /\b(the|tax|income|declaration|simplified|deadline|notify|email|telegram|business|expense)\b/i

const KAZAKH_HINTS = [
  'салық', 'декларация', 'оңайлат', 'жеке кәсіпкер', 'аек', 'мзп',
  'кіріс', 'шығыс', 'табыс', 'төлем', 'мерзім', 'жарна',
]

const RUSSIAN_HINTS = [
  'налог', 'декларация', 'упрощ', 'ип', 'мрп', 'доход', 'расход',
  'срок', 'уведом', 'взнос', 'режим',
]

export function normalizeLanguage(value: unknown): SupportedLanguage | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase().trim()
  if (normalized.startsWith('kk') || normalized.startsWith('kz')) return 'kk'
  if (normalized.startsWith('ru')) return 'ru'
  if (normalized.startsWith('en')) return 'en'
  return null
}

export function detectLanguage(text: string | null | undefined, fallback: SupportedLanguage = DEFAULT_LANGUAGE): SupportedLanguage {
  const value = (text ?? '').toLowerCase()
  if (!value.trim()) return fallback

  if (KAZAKH_CHARS.test(value) || KAZAKH_HINTS.some((hint) => value.includes(hint))) {
    return 'kk'
  }

  if (CYRILLIC_CHARS.test(value) || RUSSIAN_HINTS.some((hint) => value.includes(hint))) {
    return 'ru'
  }

  if (LATIN_WORDS.test(value)) return 'en'
  return fallback
}

export function detectLanguageFromParts(parts: Array<string | null | undefined>, fallback: SupportedLanguage = DEFAULT_LANGUAGE): SupportedLanguage {
  return detectLanguage(parts.filter(Boolean).join('\n'), fallback)
}

export function languageName(language: SupportedLanguage): string {
  switch (language) {
    case 'kk':
      return 'Kazakh'
    case 'en':
      return 'English'
    case 'ru':
      return 'Russian'
  }
}
