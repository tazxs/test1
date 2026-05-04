import type { TransactionCategory } from '../types/transaction.types'

export interface CategoryMeta {
  label: string
  color: string         // Tailwind color class token
  hexColor: string      // Exact hex for non-Tailwind contexts
  type: 'income' | 'expense' | 'neutral'
  deductible: boolean   // Whether this is a deductible expense
}

export const CATEGORY_META: Record<TransactionCategory, CategoryMeta> = {
  // ── Income ──────────────────────────────────────────────────────────────
  SERVICES_INCOME: {
    label: 'Услуги',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  GOODS_INCOME: {
    label: 'Продажа товаров',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  RENT_INCOME: {
    label: 'Аренда',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  CONSULTING_INCOME: {
    label: 'Консультации',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  FREELANCE_INCOME: {
    label: 'Фриланс',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  DIVIDEND_INCOME: {
    label: 'Дивиденды',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  INTEREST_INCOME: {
    label: 'Проценты',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  ASSET_SALE_INCOME: {
    label: 'Продажа активов',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  OTHER_INCOME: {
    label: 'Прочие доходы',
    color: 'text-green',
    hexColor: '#00E87A',
    type: 'income',
    deductible: false,
  },
  // ── Expenses ─────────────────────────────────────────────────────────────
  OFFICE_EXPENSES: {
    label: 'Офис',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  EQUIPMENT_EXPENSES: {
    label: 'Оборудование',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  MARKETING_EXPENSES: {
    label: 'Маркетинг',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  SALARY_EXPENSES: {
    label: 'Зарплата',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  TRANSPORT_EXPENSES: {
    label: 'Транспорт',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  UTILITIES_EXPENSES: {
    label: 'Коммунальные',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  INSURANCE_EXPENSES: {
    label: 'Страхование',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  TAX_EXPENSES: {
    label: 'Налоги и сборы',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: false,
  },
  BANK_EXPENSES: {
    label: 'Банковские расходы',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  REPAIR_EXPENSES: {
    label: 'Ремонт',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  SUBSCRIPTION_EXPENSES: {
    label: 'Подписки и ПО',
    color: 'text-amber',
    hexColor: '#FFB800',
    type: 'expense',
    deductible: true,
  },
  OTHER_EXPENSES: {
    label: 'Другие расходы',
    color: 'text-white-dim',
    hexColor: 'rgba(240,244,255,0.6)',
    type: 'expense',
    deductible: false,
  },
  // ── Special ───────────────────────────────────────────────────────────────
  UNCATEGORIZED: {
    label: 'Без категории',
    color: 'text-red',
    hexColor: '#FF4D4D',
    type: 'neutral',
    deductible: false,
  },
}

export const INCOME_CATEGORIES: TransactionCategory[] = [
  'SERVICES_INCOME',
  'GOODS_INCOME',
  'RENT_INCOME',
  'CONSULTING_INCOME',
  'FREELANCE_INCOME',
  'DIVIDEND_INCOME',
  'INTEREST_INCOME',
  'ASSET_SALE_INCOME',
  'OTHER_INCOME',
]

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'OFFICE_EXPENSES',
  'EQUIPMENT_EXPENSES',
  'MARKETING_EXPENSES',
  'SALARY_EXPENSES',
  'TRANSPORT_EXPENSES',
  'UTILITIES_EXPENSES',
  'INSURANCE_EXPENSES',
  'TAX_EXPENSES',
  'BANK_EXPENSES',
  'REPAIR_EXPENSES',
  'SUBSCRIPTION_EXPENSES',
  'OTHER_EXPENSES',
]

export const DEDUCTIBLE_CATEGORIES: TransactionCategory[] = EXPENSE_CATEGORIES.filter(
  (cat) => CATEGORY_META[cat].deductible
)
