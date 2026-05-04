/**
 * Transaction-related types.
 * All monetary values use number (Decimal in DB, number in API responses).
 */

export type TransactionType = 'INCOME' | 'EXPENSE'

export type TransactionSource = 'MANUAL' | 'KASPI' | 'HALYK' | 'FORTE' | 'OTHER_BANK'

export type TransactionCategory =
  // Income categories
  | 'SERVICES_INCOME'
  | 'GOODS_INCOME'
  | 'RENT_INCOME'
  | 'CONSULTING_INCOME'
  | 'FREELANCE_INCOME'
  | 'DIVIDEND_INCOME'
  | 'INTEREST_INCOME'
  | 'ASSET_SALE_INCOME'
  | 'OTHER_INCOME'
  // Expense categories
  | 'OFFICE_EXPENSES'
  | 'EQUIPMENT_EXPENSES'
  | 'MARKETING_EXPENSES'
  | 'SALARY_EXPENSES'
  | 'TRANSPORT_EXPENSES'
  | 'UTILITIES_EXPENSES'
  | 'INSURANCE_EXPENSES'
  | 'TAX_EXPENSES'
  | 'BANK_EXPENSES'
  | 'REPAIR_EXPENSES'
  | 'SUBSCRIPTION_EXPENSES'
  | 'OTHER_EXPENSES'
  // Special
  | 'UNCATEGORIZED'

export interface Transaction {
  id: string
  userId: string
  amount: number
  type: TransactionType
  category: TransactionCategory
  description: string
  source: TransactionSource
  externalId: string | null
  aiConfidence: number | null
  date: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TransactionListParams {
  page?: number
  limit?: number
  type?: TransactionType
  category?: TransactionCategory
  source?: TransactionSource
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface CreateTransactionPayload {
  amount: number
  type: TransactionType
  category: TransactionCategory
  description: string
  date: string
  source?: TransactionSource
}

export interface UpdateTransactionPayload {
  category?: TransactionCategory
  description?: string
  amount?: number
  date?: string
}

export interface TransactionSummary {
  totalIncome: number
  totalExpenses: number
  netIncome: number
  byCategory: Record<TransactionCategory, number>
  count: number
}
