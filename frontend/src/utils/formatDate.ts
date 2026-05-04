import i18n, { getCurrentLanguage, getIntlLocale } from '../i18n'

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  // If already ISO 8601 (contains 'T'), parse directly; otherwise append midnight
  return dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`)
}

/** "15 янв 2025" */
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseDate(dateStr))
}

/** "15.01.2025" */
export function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseDate(dateStr))
}

/** "15 января 2025 г." */
export function formatDateLong(dateStr: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDate(dateStr))
}

/** "3 дня назад", "только что", etc. */
export function formatRelative(dateStr: string): string {
  const date = parseDate(dateStr)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000)
  if (diffDays === 0) return i18n.t('common.format.today')
  if (diffDays === -1) return i18n.t('common.format.yesterday')
  return new Intl.RelativeTimeFormat(getIntlLocale(), { numeric: 'auto' }).format(diffDays, 'day')
}

/** "Q1 2025" → "1 квартал 2025" */
export function formatQuarterLabel(period: string): string {
  const match = /^(\d{4})-Q([1-4])$/.exec(period)
  if (!match) return period
  const [, year, q] = match
  return i18n.t('common.format.quarter', { quarter: q, year })
}

/** "2025-01" → "Январь 2025" */
export function formatMonthLabel(period: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (!match) return period
  const [, year, month] = match
  const date = new Date(Number(year), Number(month) - 1, 1)
  const formatted = new Intl.DateTimeFormat(getIntlLocale(), {
    month: 'long',
    year: 'numeric',
  }).format(date)
  return getCurrentLanguage() === 'en' ? formatted : formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/** Days until deadline (positive = future, negative = past) */
export function daysUntil(dateStr: string): number {
  const target = parseDate(dateStr)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
