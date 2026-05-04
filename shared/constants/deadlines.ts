/**
 * Tax deadline constants for Kazakhstan.
 * All dates are in MM-DD format (applied to the relevant year).
 */

export interface TaxDeadlineTemplate {
  id: string
  name: string
  description: string
  formType: string
  regime: string[]
  /** MM-DD format — relative to the reporting year unless `dueInFollowingYear` is true. */
  dueDatePattern: string
  paymentDueDatePattern?: string
  dueInFollowingYear?: boolean
  periodType: 'QUARTER' | 'HALF_YEAR' | 'YEAR' | 'MONTH'
  quarter?: 1 | 2 | 3 | 4
  halfYear?: 1 | 2
}

export const TAX_DEADLINE_TEMPLATES: TaxDeadlineTemplate[] = [
  {
    id: 'form-910-h1',
    name: 'Форма 910 — 1 полугодие',
    description: 'Упрощённая декларация за 1 полугодие',
    formType: 'FORM_910',
    regime: ['SIMPLIFIED_DECLARATION'],
    dueDatePattern: '08-15',
    paymentDueDatePattern: '08-25',
    periodType: 'HALF_YEAR',
    halfYear: 1,
  },
  {
    id: 'form-910-h2',
    name: 'Форма 910 — 2 полугодие',
    description: 'Упрощённая декларация за 2 полугодие',
    formType: 'FORM_910',
    regime: ['SIMPLIFIED_DECLARATION'],
    dueDatePattern: '02-15',
    paymentDueDatePattern: '02-25',
    dueInFollowingYear: true,
    periodType: 'HALF_YEAR',
    halfYear: 2,
  },
  {
    id: 'form-200-annual',
    name: 'Форма 200 — Годовая декларация',
    description: 'Декларация по индивидуальному подоходному налогу',
    formType: 'FORM_200',
    regime: ['GENERAL_REGIME'],
    dueDatePattern: '03-31',
    periodType: 'YEAR',
  },
  {
    id: 'opv-monthly',
    name: 'ОПВ — ежемесячный взнос',
    description: 'Обязательные пенсионные взносы (до 25 числа следующего месяца)',
    formType: 'OPV',
    regime: ['SIMPLIFIED_DECLARATION', 'GENERAL_REGIME', 'PATENT'],
    dueDatePattern: '25', // 25-е следующего месяца
    periodType: 'MONTH',
  },
]

export const URGENCY_THRESHOLDS = {
  /** Критично: меньше 7 дней */
  critical: 7,
  /** Внимание: меньше 30 дней */
  warning: 30,
  /** Норма: больше 30 дней */
} as const
