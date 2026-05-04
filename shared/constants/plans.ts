import type { SubscriptionPlan } from '../types/user.types'

export interface PlanFeature {
  label: string
  included: boolean
  limit?: string
}

export interface PlanDefinition {
  id: SubscriptionPlan
  name: string
  monthlyPrice: number   // USD
  annualPrice: number    // USD per month (billed annually)
  description: string
  features: PlanFeature[]
  isPopular: boolean
  ctaLabel: string
}

export const PLAN_DEFINITIONS: Record<SubscriptionPlan, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Бесплатный',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Для начала работы',
    isPopular: false,
    ctaLabel: 'Начать бесплатно',
    features: [
      { label: 'До 50 транзакций в месяц', included: true, limit: '50' },
      { label: 'Ручной ввод операций', included: true },
      { label: '1 декларация в квартал', included: true },
      { label: 'Базовый налоговый расчёт', included: true },
      { label: 'Синхронизация с банком', included: false },
      { label: 'AI-категоризация', included: false },
      { label: 'AI-советник', included: false },
      { label: 'PDF-декларации', included: false },
      { label: 'Telegram-уведомления', included: false },
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Про',
    monthlyPrice: 9.99,
    annualPrice: 7.99,
    description: 'Для активных предпринимателей',
    isPopular: true,
    ctaLabel: 'Выбрать Про',
    features: [
      { label: 'Безлимитные транзакции', included: true },
      { label: 'Синхронизация с банком', included: true },
      { label: 'AI-категоризация транзакций', included: true },
      { label: 'Неограниченные декларации', included: true },
      { label: 'PDF-декларации', included: true },
      { label: 'Telegram и email уведомления', included: true },
      { label: 'Базовые AI-советы (3/месяц)', included: true, limit: '3' },
      { label: 'AI-чат (полный доступ)', included: false },
      { label: 'Приоритетная поддержка', included: false },
    ],
  },
  PRO_AI: {
    id: 'PRO_AI',
    name: 'Про + AI',
    monthlyPrice: 19.99,
    annualPrice: 15.99,
    description: 'Максимальная автоматизация',
    isPopular: false,
    ctaLabel: 'Выбрать Про + AI',
    features: [
      { label: 'Всё из тарифа Про', included: true },
      { label: 'Неограниченный AI-чат', included: true },
      { label: 'Расширенная AI-аналитика', included: true },
      { label: 'Персональные советы по экономии', included: true },
      { label: 'Оптимизация налогового режима', included: true },
      { label: 'Автоматическая подача через eGov', included: true },
      { label: 'Приоритетная поддержка 24/7', included: true },
      { label: 'API доступ', included: true },
    ],
  },
}

export const PLAN_LIMITS: Record<SubscriptionPlan, { monthlyTransactions: number | null; aiRequests: number | null }> = {
  FREE: {
    monthlyTransactions: 50,
    aiRequests: 0,
  },
  PRO: {
    monthlyTransactions: null, // unlimited
    aiRequests: 3,
  },
  PRO_AI: {
    monthlyTransactions: null, // unlimited
    aiRequests: null, // unlimited
  },
}
