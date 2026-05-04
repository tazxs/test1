import { getIntlLocale } from '../i18n'

function numberFormatter(fractionDigits: number) {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'decimal',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** Returns "1 234 567 ₸" */
export function formatKZT(amount: number): string {
  return `${numberFormatter(0).format(amount)} ₸`
}

/** Returns "1 234 567,50 ₸" */
export function formatKZTDecimal(amount: number): string {
  return `${numberFormatter(2).format(amount)} ₸`
}

/** Returns "1 234 567" (no currency symbol) */
export function formatNumber(amount: number): string {
  return numberFormatter(0).format(amount)
}

/** Returns "+12 340 ₸" or "-5 000 ₸" with sign */
export function formatKZTSigned(amount: number): string {
  const prefix = amount >= 0 ? '+' : ''
  return `${prefix}${formatKZT(amount)}`
}

/** Compact: 1 234 567 → "1.2 млн ₸" */
export function formatKZTCompact(amount: number): string {
  const formatted = new Intl.NumberFormat(getIntlLocale(), {
    notation: 'compact',
    maximumFractionDigits: Math.abs(amount) >= 1_000_000 ? 1 : 0,
  }).format(amount)
  return `${formatted} ₸`
}
