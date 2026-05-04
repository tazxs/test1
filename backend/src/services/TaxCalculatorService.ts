import type { TaxCalculationResult, TaxDeduction } from 'nalogai-shared/types/declaration.types'
import type { TaxRegime } from 'nalogai-shared/types/user.types'
import {
  MRP_2025,
  MRP_2026,
  MZP_2025,
  SIMPLIFIED_DECLARATION,
  ESP_RATES,
  PATENT,
  OPV,
  OSMS,
  IPN,
  SOCIAL_TAX,
} from 'nalogai-shared/constants/taxRates'

export interface TaxCalculationInput {
  grossIncome: number
  regime: TaxRegime
  /** Number of months in the reporting period (default 12 for annual, 3 for quarterly) */
  months?: number
  /** Is the ESP taxpayer located in a rural area? */
  isRural?: boolean
  /** Additional deductions to apply (e.g. business expenses, AI-optimized deductions) */
  additionalDeductions?: TaxDeduction[]
}

// Exported for testing
export const STANDARD_DEDUCTION_AMOUNT = IPN.standardDeductionAmount
export const OSMS_ANNUAL_AMOUNT = Math.round(OSMS.annualAmount)
export const SOCIAL_TAX_ANNUAL = Math.round(SOCIAL_TAX.annualAmount)
export { MRP_2025, MRP_2026, MZP_2025 }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export const TaxCalculatorService = {
  /**
   * Calculate tax obligations for a given income and tax regime.
   * All monetary values are in KZT (Kazakhstani Tenge).
   * All amounts are rounded to the nearest whole Tenge per KZ Tax Code.
   */
  calculate(input: TaxCalculationInput): TaxCalculationResult {
    const {
      grossIncome: rawIncome,
      regime,
      months = 12,
      isRural = false,
      additionalDeductions = [],
    } = input
    // Normalise to whole tenge — KZT has no sub-unit in modern use; this also
    // prevents any IEEE-754 fractional contamination from Prisma Decimal.toNumber().
    const grossIncome = Math.round(rawIncome)

    if (grossIncome < 0) throw new Error('grossIncome cannot be negative')
    if (months < 1 || months > 12) throw new Error('months must be between 1 and 12')

    switch (regime) {
      case 'ESP':
        return this._calculateESP(grossIncome, months, isRural, additionalDeductions)
      case 'SIMPLIFIED_DECLARATION':
        return this._calculateSimplified(grossIncome, months, additionalDeductions)
      case 'PATENT':
        return this._calculatePatent(grossIncome, months, additionalDeductions)
      case 'GENERAL_REGIME':
        return this._calculateGeneral(grossIncome, months, additionalDeductions)
      default:
        throw new Error(`Unsupported tax regime: ${regime as string}`)
    }
  },

  /**
   * ESP (Единый совокупный платёж) — fixed monthly payment for self-employed.
   * Includes IPN, OPV, OSMS, and Social Tax. No percentage-based deductions apply.
   * Max annual income: 1175 MRP.
   */
  _calculateESP(
    grossIncome: number,
    months: number,
    isRural: boolean,
    additionalDeductions: TaxDeduction[],
  ): TaxCalculationResult {
    const monthlyPayment = isRural
      ? ESP_RATES.ruralMonthlyAmount
      : ESP_RATES.cityMonthlyAmount

    const incomeTax = Math.round(monthlyPayment * months)
    const totalTaxBurden = incomeTax
    const effectiveRate = grossIncome > 0 ? totalTaxBurden / grossIncome : 0

    return {
      grossIncome,
      totalDeductions: 0,
      taxableIncome: grossIncome,
      taxRate: effectiveRate,
      incomeTax,
      socialTax: 0,              // included in ESP payment
      pensionContribution: 0,    // included in ESP payment
      medicalInsurance: 0,       // included in ESP payment
      totalTaxBurden,
      effectiveRate,
      aiOptimizedSavings: 0,
      deductions: [...additionalDeductions],
      regime: 'ESP',
    }
  },

  /**
   * Упрощённая декларация (Форма 910) — 3% on gross turnover for ИП.
   * The 3% is split: 1.5% ИПН + 1.5% Социальный налог.
   * OPV and OSMS are calculated separately.
   * Max annual revenue: 24 038 MRP.
   */
  _calculateSimplified(
    grossIncome: number,
    months: number,
    additionalDeductions: TaxDeduction[],
  ): TaxCalculationResult {
    const standardDeduction: TaxDeduction = {
      id: 'standard-deduction',
      name: `Стандартный вычет (14 МРП = ${STANDARD_DEDUCTION_AMOUNT.toLocaleString('ru-KZ')} ₸)`,
      amount: STANDARD_DEDUCTION_AMOUNT,
      description: 'Ежегодный стандартный налоговый вычет согласно НК РК',
    }
    const deductions: TaxDeduction[] = [standardDeduction, ...additionalDeductions]
    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
    const taxableIncome = Math.max(0, grossIncome - totalDeductions)

    // 3% on gross income (simplified regime taxes turnover, not profit)
    // This 3% includes both IPN (1.5%) and Social Tax (1.5%)
    const totalThreePercent = Math.round(grossIncome * SIMPLIFIED_DECLARATION.taxRate)
    const incomeTax = Math.round(totalThreePercent / 2)        // ИПН = 1.5%
    const socialTax = totalThreePercent - incomeTax             // СН  = 1.5% (remainder avoids rounding gap)

    // OPV: 10% of income, capped at 50 MZP × 12
    const opvBase = clamp(grossIncome, 0, OPV.maxAnnualBase)
    const pensionContribution = Math.round(opvBase * OPV.rate)

    // OSMS: 5% × 1.4 MZP monthly × months
    const medicalInsurance = Math.round(OSMS_ANNUAL_AMOUNT * months / 12)

    const totalTaxBurden = totalThreePercent + pensionContribution + medicalInsurance
    const effectiveRate = grossIncome > 0 ? totalTaxBurden / grossIncome : 0

    return {
      grossIncome,
      totalDeductions,
      taxableIncome,
      taxRate: SIMPLIFIED_DECLARATION.taxRate,
      incomeTax,
      socialTax,
      pensionContribution,
      medicalInsurance,
      totalTaxBurden,
      effectiveRate,
      aiOptimizedSavings: 0,
      deductions,
      regime: 'SIMPLIFIED_DECLARATION',
      noActivity: grossIncome === 0,
    }
  },

  /**
   * Патент (Форма 912) — 1% on declared income for ИП.
   * Max annual revenue: 3 528 MRP. OSMS is included in patent cost.
   * Social Tax is included in patent cost.
   */
  _calculatePatent(
    grossIncome: number,
    _months: number,
    additionalDeductions: TaxDeduction[],
  ): TaxCalculationResult {
    const deductions: TaxDeduction[] = [...additionalDeductions]
    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
    const taxableIncome = Math.max(0, grossIncome - totalDeductions)

    // Patent: 1% on gross income
    const incomeTax = Math.round(grossIncome * PATENT.taxRate)

    // OPV: 10% of income, capped at 50 MZP × 12
    const opvBase = clamp(grossIncome, 0, OPV.maxAnnualBase)
    const pensionContribution = Math.round(opvBase * OPV.rate)

    // OSMS and Social Tax included in patent cost
    const medicalInsurance = 0
    const socialTax = 0

    const totalTaxBurden = incomeTax + pensionContribution
    const effectiveRate = grossIncome > 0 ? totalTaxBurden / grossIncome : 0

    return {
      grossIncome,
      totalDeductions,
      taxableIncome,
      taxRate: PATENT.taxRate,
      incomeTax,
      socialTax,
      pensionContribution,
      medicalInsurance,
      totalTaxBurden,
      effectiveRate,
      aiOptimizedSavings: 0,
      deductions,
      regime: 'PATENT',
    }
  },

  /**
   * Общий режим (ИПН) — 10% on taxable income after deductions.
   * Social Tax: 2 МРП/month − ОСМС contribution (floor 0).
   * OPV: 10%, OSMS: 5% × 1.4 MZP.
   */
  _calculateGeneral(
    grossIncome: number,
    months: number,
    additionalDeductions: TaxDeduction[],
  ): TaxCalculationResult {
    const standardDeduction: TaxDeduction = {
      id: 'standard-deduction',
      name: `Стандартный вычет (14 МРП = ${STANDARD_DEDUCTION_AMOUNT.toLocaleString('ru-KZ')} ₸)`,
      amount: STANDARD_DEDUCTION_AMOUNT,
      description: 'Ежегодный стандартный налоговый вычет согласно НК РК',
    }
    const deductions: TaxDeduction[] = [standardDeduction, ...additionalDeductions]
    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
    const taxableIncome = Math.max(0, grossIncome - totalDeductions)

    // IPN: 10% on taxable income
    const incomeTax = Math.round(taxableIncome * IPN.standardRate)

    // OPV: 10% of gross income, capped at 50 MZP × 12
    const opvBase = clamp(grossIncome, 0, OPV.maxAnnualBase)
    const pensionContribution = Math.round(opvBase * OPV.rate)

    // OSMS: 5% × 1.4 MZP monthly × months
    const medicalInsurance = Math.round(OSMS_ANNUAL_AMOUNT * months / 12)

    // Social Tax: 2 МРП/month × months − ОСМС (floor 0)
    // Per НК РК ст. 687: СН = 2 МРП − ОСМС за тот же период
    const grossSocialTax = Math.round(SOCIAL_TAX.monthlyAmount * months)
    const socialTax = Math.max(0, grossSocialTax - medicalInsurance)

    const totalTaxBurden = incomeTax + socialTax + pensionContribution + medicalInsurance
    const effectiveRate = grossIncome > 0 ? totalTaxBurden / grossIncome : 0

    return {
      grossIncome,
      totalDeductions,
      taxableIncome,
      taxRate: IPN.standardRate,
      incomeTax,
      socialTax,
      pensionContribution,
      medicalInsurance,
      totalTaxBurden,
      effectiveRate,
      aiOptimizedSavings: 0,
      deductions,
      regime: 'GENERAL_REGIME',
    }
  },
}
