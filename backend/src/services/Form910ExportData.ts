export type Form910PeriodType = 'QUARTER' | 'HALF_YEAR' | 'YEAR' | 'MONTH'

export type Form910RowKey =
  | 'row1'
  | 'row2'
  | 'row3'
  | 'row4'
  | 'row5'
  | 'row6'
  | 'row7'
  | 'row8'
  | 'row9'
  | 'row10'
  | 'row11'
  | 'row12'
  | 'row13'
  | 'row14'
  | 'row15'

export type Form910Rows = Record<Form910RowKey, number>

export interface Form910PeriodMeta {
  year: number
  periodType: Form910PeriodType
  periodNum: number
  halfYear: number
  kgdPeriodType: 'H'
}

export interface Form910ExportInput {
  iin: string
  fullName: string
  period: string
  grossIncome: number
  simplifiedTax: number
  incomeTax: number
  socialTax: number
  pensionContrib: number
  medicalInsurance: number
  employeeCount: number
  totalObligations?: number
  incomeCode?: string
  activityCodes?: string[]
  transferPricingIncome?: number
  taxAdjustment?: number
  avgMonthlySalary?: number
}

export interface Form910ExportData {
  iin: string
  fullName: string
  year: number
  period: number
  periodType: 'H'
  isFirstDelivery: true
  version: 27
  revision: 133
  incomeCode: string
  activityCodes: string[]
  rows: Form910Rows
  totalObligations: number
}

export const FORM910_SCHEMA_VERSION = 27
export const FORM910_SCHEMA_REVISION = 133
export const DEFAULT_FORM910_INCOME_CODE = '001'
export const DEFAULT_FORM910_ACTIVITY_CODES = ['00000'] as const

export function parseForm910Period(period: string): Form910PeriodMeta {
  const halfYearMatch = /^(\d{4})-H([1-2])$/.exec(period)
  if (halfYearMatch) {
    const halfYear = parseInt(halfYearMatch[2]!, 10)
    return {
      year: parseInt(halfYearMatch[1]!, 10),
      periodType: 'HALF_YEAR',
      periodNum: halfYear,
      halfYear,
      kgdPeriodType: 'H',
    }
  }

  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(period)
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[2]!, 10)
    return {
      year: parseInt(quarterMatch[1]!, 10),
      periodType: 'QUARTER',
      periodNum: quarter,
      halfYear: quarter <= 2 ? 1 : 2,
      kgdPeriodType: 'H',
    }
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(period)
  if (monthMatch) {
    const month = parseInt(monthMatch[2]!, 10)
    return {
      year: parseInt(monthMatch[1]!, 10),
      periodType: 'MONTH',
      periodNum: month,
      halfYear: month <= 6 ? 1 : 2,
      kgdPeriodType: 'H',
    }
  }

  const yearMatch = /^(\d{4})$/.exec(period)
  if (yearMatch) {
    return {
      year: parseInt(yearMatch[1]!, 10),
      periodType: 'YEAR',
      periodNum: 0,
      halfYear: 1,
      kgdPeriodType: 'H',
    }
  }

  throw new Error(`Unknown period format: ${period}`)
}

function roundAmount(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0)
}

function normalizeActivityCodes(activityCodes: string[] | undefined): string[] {
  const normalized = (activityCodes ?? [])
    .map((code) => code.trim())
    .filter(Boolean)

  return normalized.length > 0 ? normalized : [...DEFAULT_FORM910_ACTIVITY_CODES]
}

export function buildForm910ExportData(input: Form910ExportInput): Form910ExportData {
  const period = parseForm910Period(input.period)
  const simplifiedTax = roundAmount(input.simplifiedTax)
  const transferPricingIncome = roundAmount(input.transferPricingIncome ?? 0)
  const taxAdjustment = roundAmount(input.taxAdjustment ?? 0)
  const taxAfterAdjustment = Math.max(0, simplifiedTax - taxAdjustment)
  const incomeTax = roundAmount(input.incomeTax)
  const socialTax = roundAmount(input.socialTax)
  const pensionContrib = roundAmount(input.pensionContrib)
  const medicalInsurance = roundAmount(input.medicalInsurance)
  const totalObligations = input.totalObligations == null
    ? taxAfterAdjustment + pensionContrib + medicalInsurance
    : roundAmount(input.totalObligations)

  return {
    iin: input.iin,
    fullName: input.fullName,
    year: period.year,
    period: period.halfYear,
    periodType: period.kgdPeriodType,
    isFirstDelivery: true,
    version: FORM910_SCHEMA_VERSION,
    revision: FORM910_SCHEMA_REVISION,
    incomeCode: input.incomeCode?.trim() || DEFAULT_FORM910_INCOME_CODE,
    activityCodes: normalizeActivityCodes(input.activityCodes),
    rows: {
      row1: roundAmount(input.grossIncome),
      row2: transferPricingIncome,
      row3: Math.max(0, Math.round(input.employeeCount)),
      row4: roundAmount(input.avgMonthlySalary ?? 0),
      row5: simplifiedTax,
      row6: taxAdjustment,
      row7: taxAfterAdjustment,
      row8: incomeTax,
      row9: socialTax,
      row10: 0,
      row11: 0,
      row12: roundAmount(input.grossIncome),
      row13: pensionContrib,
      row14: 0,
      row15: medicalInsurance,
    },
    totalObligations,
  }
}
