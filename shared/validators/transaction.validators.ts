import { z } from 'zod'

const TRANSACTION_CATEGORIES = [
  'SERVICES_INCOME',
  'GOODS_INCOME',
  'RENT_INCOME',
  'CONSULTING_INCOME',
  'FREELANCE_INCOME',
  'DIVIDEND_INCOME',
  'INTEREST_INCOME',
  'ASSET_SALE_INCOME',
  'OTHER_INCOME',
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
  'UNCATEGORIZED',
] as const

const TRANSACTION_SOURCES = [
  'MANUAL',
  'KASPI',
  'HALYK',
  'FORTE',
  'OTHER_BANK',
] as const

export const createTransactionSchema = z.object({
  amount: z
    .number({ required_error: 'Сумма обязательна' })
    .positive('Сумма должна быть положительной')
    .max(999_999_999_999, 'Сумма слишком большая'),
  type: z.enum(['INCOME', 'EXPENSE'], {
    required_error: 'Укажите тип операции',
  }),
  category: z.enum(TRANSACTION_CATEGORIES, {
    required_error: 'Выберите категорию',
  }),
  description: z
    .string({ required_error: 'Описание обязательно' })
    .min(1, 'Описание обязательно')
    .max(500, 'Описание слишком длинное'),
  date: z
    .string({ required_error: 'Дата обязательна' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD'),
  source: z.enum(TRANSACTION_SOURCES).optional().default('MANUAL'),
})

export const updateTransactionSchema = z.object({
  category: z.enum(TRANSACTION_CATEGORIES).optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.number().positive().max(999_999_999_999).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const transactionListParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  category: z.enum(TRANSACTION_CATEGORIES).optional(),
  source: z.enum(TRANSACTION_SOURCES).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().max(200).optional(),
})

export const aiCategorizeTransactionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
})

export const aiCategorizeBulkSchema = z.object({
  transactions: z
    .array(aiCategorizeTransactionSchema)
    .min(1)
    .max(50, 'Максимум 50 транзакций за раз'),
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type TransactionListParamsInput = z.infer<typeof transactionListParamsSchema>
export type AICategorizeBulkInput = z.infer<typeof aiCategorizeBulkSchema>
