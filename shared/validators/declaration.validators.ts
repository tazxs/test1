import { z } from 'zod'

const DECLARATION_STATUS = [
  'DRAFT',
  'READY',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
] as const

const DECLARATION_PERIOD_TYPE = ['QUARTER', 'YEAR', 'MONTH'] as const

const DECLARATION_FORM_TYPE = [
  'FORM_200',
  'FORM_910',
  'FORM_912',
  'ESP',
] as const

// Period format: YYYY-Q1, YYYY-Q2, YYYY-Q3, YYYY-Q4, YYYY-01 through YYYY-12, YYYY
const QUARTER_PERIOD_REGEX = /^\d{4}-Q[1-4]$/
const MONTH_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/
const YEAR_PERIOD_REGEX = /^\d{4}$/

function validatePeriod(period: string, periodType: string): boolean {
  if (periodType === 'QUARTER') return QUARTER_PERIOD_REGEX.test(period)
  if (periodType === 'MONTH') return MONTH_PERIOD_REGEX.test(period)
  if (periodType === 'YEAR') return YEAR_PERIOD_REGEX.test(period)
  return false
}

export const createDeclarationSchema = z
  .object({
    period: z
      .string({ required_error: 'Период обязателен' })
      .min(4, 'Некорректный формат периода'),
    periodType: z.enum(DECLARATION_PERIOD_TYPE, {
      required_error: 'Укажите тип периода',
    }),
    formType: z.enum(DECLARATION_FORM_TYPE, {
      required_error: 'Выберите форму декларации',
    }),
  })
  .refine(
    (data) => validatePeriod(data.period, data.periodType),
    {
      message:
        'Некорректный формат периода. Квартал: YYYY-Q1, Месяц: YYYY-01, Год: YYYY',
      path: ['period'],
    }
  )

export const declarationListParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(DECLARATION_STATUS).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export const submitDeclarationSchema = z.object({
  declarationId: z.string().uuid('Некорректный ID декларации'),
})

export type CreateDeclarationInput = z.infer<typeof createDeclarationSchema>
export type DeclarationListParamsInput = z.infer<typeof declarationListParamsSchema>
export type SubmitDeclarationInput = z.infer<typeof submitDeclarationSchema>
