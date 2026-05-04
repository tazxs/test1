/// <reference types="vite/client" />
/** App-wide constants. All user-facing strings in Russian. */

export const APP_NAME = 'NalogAI'
export const APP_TAGLINE = 'Налоги без боли'
export const APP_DESCRIPTION =
  'AI-ассистент по налогам для самозанятых и ИП в Казахстане'

export const API_BASE_URL = import.meta.env['VITE_API_URL'] as string ?? '/api'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  TRANSACTIONS: '/transactions',
  DECLARATIONS: '/declarations',
  DECLARATION_DETAIL: '/declarations/:id',
  AI_ADVISOR: '/advisor',
  DEADLINES: '/deadlines',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  BILLING: '/billing',
  PRICING: '/pricing',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_SUPPORT: '/admin/support',
} as const

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 50,
} as const

export const TOAST_DURATION_MS = 4000
export const AI_REQUEST_TIMEOUT_MS = 30_000

export const KZT_SYMBOL = '₸'

/** Business type labels */
export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  SELF_EMPLOYED: 'Самозанятый',
  SOLE_PROPRIETOR: 'Индивидуальный предприниматель (ИП)',
  LLC: 'ТОО',
}

/** Tax regime labels */
export const TAX_REGIME_LABELS: Record<string, string> = {
  SIMPLIFIED_DECLARATION: 'Упрощённая декларация (3%)',
  GENERAL_REGIME: 'Общий режим',
  PATENT: 'Патент (1%)',
  ESP: 'Единый совокупный платёж (ЕСП)',
}

/** Declaration status labels */
export const DECLARATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  READY: 'Готова',
  SUBMITTED: 'Отправлена',
  ACCEPTED: 'Принята',
  REJECTED: 'Отклонена',
}

/** Declaration form type labels */
export const FORM_TYPE_LABELS: Record<string, string> = {
  FORM_200: 'Форма 200 (ИПН)',
  FORM_910: 'Форма 910 (Упрощённая)',
  FORM_912: 'Форма 912 (Патент)',
  ESP: 'ЕСП',
}

/** Bank provider labels */
export const BANK_PROVIDER_LABELS: Record<string, string> = {
  KASPI: 'Kaspi Bank',
  HALYK: 'Halyk Bank',
  OTHER: 'Другой банк',
}
