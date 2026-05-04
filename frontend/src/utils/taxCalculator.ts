import type {
  TaxCalculationResult,
  TaxDeduction,
  DeclarationFormType,
} from 'nalogai-shared/types/declaration.types'
import {
  SIMPLIFIED_DECLARATION,
  ESP_RATES,
  PATENT,
  OPV,
  OSMS,
  IPN,
  SOCIAL_TAX,
} from 'nalogai-shared/constants/taxRates'

const STANDARD_DEDUCTION = IPN.standardDeductionAmount
const OSMS_ANNUAL = Math.round(OSMS.annualAmount)

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Parse a declaration period string like "2025-Q1" into a [from, to] date range. */
export function periodToDateRange(period: string): { from: Date; to: Date } | null {
  const qMatch = /^(\d{4})-Q([1-4])$/.exec(period)
  if (qMatch) {
    const year = parseInt(qMatch[1]!, 10)
    const q    = parseInt(qMatch[2]!, 10)
    const monthStart = (q - 1) * 3 // 0, 3, 6, 9
    const from = new Date(year, monthStart, 1)
    const to   = new Date(year, monthStart + 3, 0) // last day of quarter
    return { from, to }
  }
  const yMatch = /^(\d{4})$/.exec(period)
  if (yMatch) {
    const year = parseInt(yMatch[1]!, 10)
    return { from: new Date(year, 0, 1), to: new Date(year, 11, 31) }
  }
  const mMatch = /^(\d{4})-(\d{2})$/.exec(period)
  if (mMatch) {
    const year  = parseInt(mMatch[1]!, 10)
    const month = parseInt(mMatch[2]!, 10) - 1
    return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0) }
  }
  return null
}

/** Calculate tax obligation for a given form type and gross income. */
export function calcTaxForFormType(
  formType: DeclarationFormType,
  grossIncome: number,
  months = 3,
  additionalDeductions: TaxDeduction[] = [],
): TaxCalculationResult {
  switch (formType) {
    case 'FORM_910': return calcSimplified(grossIncome, months, additionalDeductions)
    case 'FORM_912': return calcPatent(grossIncome, months, additionalDeductions)
    case 'FORM_200': return calcGeneral(grossIncome, months, additionalDeductions)
    case 'ESP':      return calcESP(grossIncome, months)
    default:         return calcSimplified(grossIncome, months, additionalDeductions)
  }
}

function calcSimplified(
  grossIncome: number,
  months: number,
  extra: TaxDeduction[],
): TaxCalculationResult {
  const std: TaxDeduction = {
    id: 'std',
    name: `Стандартный вычет (14 МРП = ${STANDARD_DEDUCTION.toLocaleString('ru-KZ')} ₸)`,
    amount: STANDARD_DEDUCTION,
    description: 'Ежегодный стандартный налоговый вычет согласно НК РК',
  }
  const deductions = [std, ...extra]
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
  const taxableIncome = Math.max(0, grossIncome - totalDeductions)
  // 3% = ИПН (1.5%) + СН (1.5%)
  const totalThreePercent = Math.round(grossIncome * SIMPLIFIED_DECLARATION.taxRate)
  const incomeTax = Math.round(totalThreePercent / 2)
  const socialTax = totalThreePercent - incomeTax
  const opvBase = clamp(grossIncome, 0, OPV.maxAnnualBase)
  const pensionContribution = Math.round(opvBase * OPV.rate)
  const medicalInsurance = Math.round(OSMS_ANNUAL * months / 12)
  const totalTaxBurden = totalThreePercent + pensionContribution + medicalInsurance
  return {
    grossIncome, totalDeductions, taxableIncome,
    taxRate: SIMPLIFIED_DECLARATION.taxRate, incomeTax, socialTax,
    pensionContribution, medicalInsurance, totalTaxBurden,
    effectiveRate: grossIncome > 0 ? totalTaxBurden / grossIncome : 0,
    aiOptimizedSavings: 0, deductions,
    regime: 'SIMPLIFIED_DECLARATION',
  }
}

function calcPatent(
  grossIncome: number,
  _months: number,
  extra: TaxDeduction[],
): TaxCalculationResult {
  const deductions = [...extra]
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
  const taxableIncome = Math.max(0, grossIncome - totalDeductions)
  const incomeTax = Math.round(grossIncome * PATENT.taxRate)
  const opvBase = clamp(grossIncome, 0, OPV.maxAnnualBase)
  const pensionContribution = Math.round(opvBase * OPV.rate)
  const totalTaxBurden = incomeTax + pensionContribution
  return {
    grossIncome, totalDeductions, taxableIncome,
    taxRate: PATENT.taxRate, incomeTax, socialTax: 0,
    pensionContribution, medicalInsurance: 0, totalTaxBurden,
    effectiveRate: grossIncome > 0 ? totalTaxBurden / grossIncome : 0,
    aiOptimizedSavings: 0, deductions,
    regime: 'PATENT',
  }
}

function calcGeneral(
  grossIncome: number,
  months: number,
  extra: TaxDeduction[],
): TaxCalculationResult {
  const std: TaxDeduction = {
    id: 'std',
    name: `Стандартный вычет (14 МРП = ${STANDARD_DEDUCTION.toLocaleString('ru-KZ')} ₸)`,
    amount: STANDARD_DEDUCTION,
    description: 'Ежегодный стандартный налоговый вычет согласно НК РК',
  }
  const deductions = [std, ...extra]
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
  const taxableIncome = Math.max(0, grossIncome - totalDeductions)
  const incomeTax = Math.round(taxableIncome * IPN.standardRate)
  const opvBase = clamp(grossIncome, 0, OPV.maxAnnualBase)
  const pensionContribution = Math.round(opvBase * OPV.rate)
  const medicalInsurance = Math.round(OSMS_ANNUAL * months / 12)
  const grossSocialTax = Math.round(SOCIAL_TAX.monthlyAmount * months)
  const socialTax = Math.max(0, grossSocialTax - medicalInsurance)
  const totalTaxBurden = incomeTax + socialTax + pensionContribution + medicalInsurance
  return {
    grossIncome, totalDeductions, taxableIncome,
    taxRate: IPN.standardRate, incomeTax, socialTax,
    pensionContribution, medicalInsurance, totalTaxBurden,
    effectiveRate: grossIncome > 0 ? totalTaxBurden / grossIncome : 0,
    aiOptimizedSavings: 0, deductions,
    regime: 'GENERAL_REGIME',
  }
}

function calcESP(grossIncome: number, months: number): TaxCalculationResult {
  const incomeTax = Math.round(ESP_RATES.cityMonthlyAmount * months)
  const eff = grossIncome > 0 ? incomeTax / grossIncome : 0
  return {
    grossIncome, totalDeductions: 0, taxableIncome: grossIncome,
    taxRate: eff, incomeTax, socialTax: 0,
    pensionContribution: 0, medicalInsurance: 0, totalTaxBurden: incomeTax,
    effectiveRate: eff, aiOptimizedSavings: 0, deductions: [],
    regime: 'ESP',
  }
}
