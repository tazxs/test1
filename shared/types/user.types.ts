/**
 * User & auth-related types.
 * Decimal fields from Prisma are represented as number here (frontend-safe).
 */

export type BusinessType = 'SELF_EMPLOYED' | 'SOLE_PROPRIETOR' | 'LLC'

export type TaxRegime =
  | 'SIMPLIFIED_DECLARATION' // Упрощённая декларация (3%)
  | 'GENERAL_REGIME'         // Общий режим
  | 'PATENT'                 // Патент
  | 'ESP'                    // Единый совокупный платёж

export type SubscriptionPlan = 'FREE' | 'PRO' | 'PRO_AI'
export type UserRole = 'USER' | 'ADMIN'
export type PreferredLanguage = 'ru' | 'kk' | 'en'

export interface User {
  id: string
  email: string
  fullName: string
  iin: string | null
  businessType: BusinessType
  taxRegime: TaxRegime
  plan: SubscriptionPlan
  role: UserRole
  preferredLanguage: PreferredLanguage
  telegramChatId: string | null
  emailNotifications: boolean
  telegramNotifications: boolean
  notifyDaysBefore: number[]
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  id: string
  email: string
  fullName: string
  iin: string | null
  businessType: BusinessType
  taxRegime: TaxRegime
  plan: SubscriptionPlan
  role: UserRole
  preferredLanguage: PreferredLanguage
}

export interface AuthTokens {
  accessToken: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  fullName: string
}

export interface OnboardingPayload {
  businessType: BusinessType
  taxRegime: TaxRegime
  iin?: string
}

export interface UpdateProfilePayload {
  fullName?: string
  iin?: string
  businessType?: BusinessType
  taxRegime?: TaxRegime
  preferredLanguage?: PreferredLanguage
}

export interface UpdateNotificationPrefsPayload {
  emailNotifications?: boolean
  telegramNotifications?: boolean
  notifyDaysBefore?: number[]
}
