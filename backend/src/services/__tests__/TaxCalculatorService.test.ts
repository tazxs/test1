import { describe, it, expect } from 'vitest'
import {
  TaxCalculatorService,
  STANDARD_DEDUCTION_AMOUNT,
  OSMS_ANNUAL_AMOUNT,
  SOCIAL_TAX_ANNUAL,
  MRP_2025,
  MZP_2025,
} from '../TaxCalculatorService'
import type { TaxDeduction } from 'nalogai-shared/types/declaration.types'
import { SOCIAL_TAX, OPV } from 'nalogai-shared/constants/taxRates'

// ── Constants for assertions ──────────────────────────────────────────────────
// ESP city: 1 MRP/month = 3 932 ₸/month
const ESP_CITY_MONTHLY = MRP_2025           // 3 932
const ESP_CITY_ANNUAL  = MRP_2025 * 12      // 47 184
// ESP rural: 0.5 MRP/month
const ESP_RURAL_MONTHLY = MRP_2025 * 0.5   // 1 966
const ESP_RURAL_ANNUAL  = ESP_RURAL_MONTHLY * 12  // 23 592
// OSMS annual: 5% × (85 000 × 1.4) × 12 = 71 400
const OSMS = OSMS_ANNUAL_AMOUNT            // 71 400
// Social Tax annual: 2 MRP × 12 = 94 368
const SN_ANNUAL = SOCIAL_TAX_ANNUAL        // 94 368
// OPV max annual base: 50 MZP × 12
const OPV_MAX_BASE = MZP_2025 * 50 * 12   // 51 000 000

// ── ESP ───────────────────────────────────────────────────────────────────────
describe('TaxCalculatorService — ESP regime', () => {
  it('city: fixed annual payment = 12 × MRP', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 2_000_000,
      regime: 'ESP',
    })
    expect(result.regime).toBe('ESP')
    expect(result.incomeTax).toBe(ESP_CITY_ANNUAL)
    expect(result.socialTax).toBe(0)
    expect(result.pensionContribution).toBe(0)
    expect(result.medicalInsurance).toBe(0)
    expect(result.totalTaxBurden).toBe(ESP_CITY_ANNUAL)
    expect(result.totalDeductions).toBe(0)
    expect(result.taxableIncome).toBe(2_000_000)
  })

  it('city: partial year (3 months) = 3 × MRP', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 500_000,
      regime: 'ESP',
      months: 3,
    })
    expect(result.incomeTax).toBe(Math.round(ESP_CITY_MONTHLY * 3))
    expect(result.totalTaxBurden).toBe(Math.round(ESP_CITY_MONTHLY * 3))
  })

  it('city: single month', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 100_000,
      regime: 'ESP',
      months: 1,
    })
    expect(result.incomeTax).toBe(Math.round(ESP_CITY_MONTHLY))
  })

  it('rural: fixed annual payment = 6 × MRP (0.5 MRP × 12)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 1_000_000,
      regime: 'ESP',
      isRural: true,
    })
    expect(result.incomeTax).toBe(Math.round(ESP_RURAL_ANNUAL))
    expect(result.totalTaxBurden).toBe(Math.round(ESP_RURAL_ANNUAL))
  })

  it('rural: partial year (6 months)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 500_000,
      regime: 'ESP',
      isRural: true,
      months: 6,
    })
    expect(result.incomeTax).toBe(Math.round(ESP_RURAL_MONTHLY * 6))
  })

  it('effective rate = totalTaxBurden / grossIncome', () => {
    const grossIncome = 1_000_000
    const result = TaxCalculatorService.calculate({ grossIncome, regime: 'ESP' })
    expect(result.effectiveRate).toBeCloseTo(ESP_CITY_ANNUAL / grossIncome, 8)
    expect(result.taxRate).toBeCloseTo(result.effectiveRate, 8)
  })

  it('zero income: effectiveRate = 0 (no division by zero)', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 0, regime: 'ESP' })
    expect(result.effectiveRate).toBe(0)
    expect(result.incomeTax).toBe(ESP_CITY_ANNUAL)
    expect(result.totalTaxBurden).toBe(ESP_CITY_ANNUAL)
  })

  it('additional deductions are passed through (informational only)', () => {
    const extra: TaxDeduction = {
      id: 'e1', name: 'Test', amount: 50_000, description: 'Test deduction',
    }
    const result = TaxCalculatorService.calculate({
      grossIncome: 1_000_000,
      regime: 'ESP',
      additionalDeductions: [extra],
    })
    expect(result.deductions).toHaveLength(1)
    // ESP ignores deductions for calculation
    expect(result.totalDeductions).toBe(0)
  })
})

// ── Simplified Declaration ────────────────────────────────────────────────────
describe('TaxCalculatorService — SIMPLIFIED_DECLARATION regime', () => {
  it('3% tax on gross income, split 1.5% IPN + 1.5% SN', () => {
    const grossIncome = 5_000_000
    const result = TaxCalculatorService.calculate({ grossIncome, regime: 'SIMPLIFIED_DECLARATION' })

    expect(result.regime).toBe('SIMPLIFIED_DECLARATION')
    expect(result.taxRate).toBe(0.03)
    // Total 3% = 150 000
    const total3pct = Math.round(grossIncome * 0.03)
    expect(result.incomeTax + result.socialTax).toBe(total3pct)
    expect(result.incomeTax).toBe(Math.round(total3pct / 2))
    expect(result.socialTax).toBe(total3pct - result.incomeTax)
  })

  it('OPV = 10% of income (within cap)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 5_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    expect(result.pensionContribution).toBe(500_000)
  })

  it('OSMS = fixed annual amount (71 400 ₸) for 12 months', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 5_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    expect(result.medicalInsurance).toBe(OSMS)
  })

  it('OSMS prorated for 3 months (quarterly)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 5_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
      months: 3,
    })
    expect(result.medicalInsurance).toBe(Math.round(OSMS * 3 / 12))
  })

  it('standard deduction (14 MRP) applied to taxable income', () => {
    const grossIncome = 5_000_000
    const result = TaxCalculatorService.calculate({ grossIncome, regime: 'SIMPLIFIED_DECLARATION' })

    expect(result.totalDeductions).toBe(STANDARD_DEDUCTION_AMOUNT)
    expect(result.taxableIncome).toBe(grossIncome - STANDARD_DEDUCTION_AMOUNT)
  })

  it('totalTaxBurden = 3% + pension + medical', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 5_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    const total3pct = result.incomeTax + result.socialTax
    expect(result.totalTaxBurden).toBe(
      total3pct + result.pensionContribution + result.medicalInsurance,
    )
  })

  it('OPV capped at 50 MZP × 12 = 51 000 000', () => {
    const grossIncome = 60_000_000
    const result = TaxCalculatorService.calculate({ grossIncome, regime: 'SIMPLIFIED_DECLARATION' })
    expect(result.pensionContribution).toBe(OPV_MAX_BASE * 0.1)
  })

  it('zero income: effectiveRate = 0, only OSMS applies, noActivity = true (Form 910.00 no-activity flag)', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 0, regime: 'SIMPLIFIED_DECLARATION' })
    expect(result.incomeTax).toBe(0)
    expect(result.socialTax).toBe(0)
    expect(result.pensionContribution).toBe(0)
    expect(result.medicalInsurance).toBe(OSMS)
    expect(result.taxableIncome).toBe(0)
    expect(result.effectiveRate).toBe(0)
    expect(result.totalTaxBurden).toBe(OSMS)
    // Form 910.00 must mark "no activity" when turnover = 0
    expect(result.noActivity).toBe(true)
  })

  it('non-zero income: noActivity = false', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 1_000_000, regime: 'SIMPLIFIED_DECLARATION' })
    expect(result.noActivity).toBe(false)
  })

  it('additional deductions reduce taxableIncome', () => {
    const extra: TaxDeduction = {
      id: 'extra-1',
      name: 'Аренда офиса',
      amount: 600_000,
      description: 'Расходы на аренду',
    }
    const result = TaxCalculatorService.calculate({
      grossIncome: 5_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
      additionalDeductions: [extra],
    })
    expect(result.deductions).toHaveLength(2)
    expect(result.totalDeductions).toBe(STANDARD_DEDUCTION_AMOUNT + 600_000)
    expect(result.taxableIncome).toBe(5_000_000 - STANDARD_DEDUCTION_AMOUNT - 600_000)
  })

  it('odd gross income: IPN + SN = total 3% exactly (no rounding gap)', () => {
    const grossIncome = 1_000_001  // 3% = 30 000.03, rounds to 30 000
    const result = TaxCalculatorService.calculate({ grossIncome, regime: 'SIMPLIFIED_DECLARATION' })
    const total3pct = Math.round(grossIncome * 0.03)
    expect(result.incomeTax + result.socialTax).toBe(total3pct)
  })

  it('taxableIncome floored at 0 when deductions exceed income', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 30_000,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    expect(result.taxableIncome).toBe(0)
  })
})

// ── Patent ────────────────────────────────────────────────────────────────────
describe('TaxCalculatorService — PATENT regime', () => {
  it('1% tax on gross income', () => {
    const grossIncome = 2_000_000
    const result = TaxCalculatorService.calculate({ grossIncome, regime: 'PATENT' })

    expect(result.regime).toBe('PATENT')
    expect(result.taxRate).toBe(0.01)
    expect(result.incomeTax).toBe(20_000)
  })

  it('socialTax = 0 (included in patent cost)', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 2_000_000, regime: 'PATENT' })
    expect(result.socialTax).toBe(0)
  })

  it('OPV = 10% of income', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 2_000_000, regime: 'PATENT' })
    expect(result.pensionContribution).toBe(200_000)
  })

  it('OSMS = 0 (included in patent cost)', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 2_000_000, regime: 'PATENT' })
    expect(result.medicalInsurance).toBe(0)
  })

  it('totalTaxBurden = incomeTax + pension (no OSMS, no SN)', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 2_000_000, regime: 'PATENT' })
    expect(result.totalTaxBurden).toBe(20_000 + 200_000)
    expect(result.effectiveRate).toBeCloseTo(0.11, 4)
  })

  it('no standard deduction by default', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 2_000_000, regime: 'PATENT' })
    expect(result.deductions).toHaveLength(0)
    expect(result.totalDeductions).toBe(0)
  })

  it('OPV capped at 50 MZP × 12', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 60_000_000, regime: 'PATENT' })
    expect(result.pensionContribution).toBe(OPV_MAX_BASE * 0.10)
  })

  it('zero income', () => {
    const result = TaxCalculatorService.calculate({ grossIncome: 0, regime: 'PATENT' })
    expect(result.incomeTax).toBe(0)
    expect(result.pensionContribution).toBe(0)
    expect(result.totalTaxBurden).toBe(0)
    expect(result.effectiveRate).toBe(0)
  })

  it('additional deductions reduce taxableIncome but not incomeTax', () => {
    const extra: TaxDeduction = {
      id: 'e1', name: 'Expense', amount: 100_000, description: 'Test',
    }
    const result = TaxCalculatorService.calculate({
      grossIncome: 2_000_000,
      regime: 'PATENT',
      additionalDeductions: [extra],
    })
    expect(result.taxableIncome).toBe(1_900_000)
    // Patent taxes gross income, not taxable
    expect(result.incomeTax).toBe(Math.round(2_000_000 * 0.01))
  })
})

// ── General Regime ────────────────────────────────────────────────────────────
describe('TaxCalculatorService — GENERAL_REGIME', () => {
  it('IPN = 10% on taxable income (after standard deduction)', () => {
    const grossIncome = 10_000_000
    const result = TaxCalculatorService.calculate({ grossIncome, regime: 'GENERAL_REGIME' })

    expect(result.regime).toBe('GENERAL_REGIME')
    expect(result.taxRate).toBe(0.10)
    const expectedTaxable = grossIncome - STANDARD_DEDUCTION_AMOUNT
    expect(result.taxableIncome).toBe(expectedTaxable)
    expect(result.incomeTax).toBe(Math.round(expectedTaxable * 0.10))
  })

  it('Social Tax = 2 MRP/month × 12 − OSMS (floored at 0)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 10_000_000,
      regime: 'GENERAL_REGIME',
    })
    // SN gross = 2 × 3932 × 12 = 94 368
    // OSMS = 71 400
    // SN net = 94 368 − 71 400 = 22 968
    const expectedSN = Math.max(0, SN_ANNUAL - OSMS)
    expect(result.socialTax).toBe(expectedSN)
  })

  it('Social Tax for partial year (3 months)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 10_000_000,
      regime: 'GENERAL_REGIME',
      months: 3,
    })
    const grossSN = Math.round(SOCIAL_TAX.monthlyAmount * 3)
    const osms3mo = Math.round(OSMS * 3 / 12)
    expect(result.socialTax).toBe(Math.max(0, grossSN - osms3mo))
    expect(result.medicalInsurance).toBe(osms3mo)
  })

  it('OPV = 10% of gross income', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 10_000_000,
      regime: 'GENERAL_REGIME',
    })
    expect(result.pensionContribution).toBe(1_000_000)
  })

  it('OSMS = fixed annual amount (71 400 ₸)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 10_000_000,
      regime: 'GENERAL_REGIME',
    })
    expect(result.medicalInsurance).toBe(OSMS)
  })

  it('totalTaxBurden = incomeTax + socialTax + pension + medical', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 10_000_000,
      regime: 'GENERAL_REGIME',
    })
    expect(result.totalTaxBurden).toBe(
      result.incomeTax + result.socialTax + result.pensionContribution + result.medicalInsurance,
    )
  })

  it('additional deductions reduce taxable income and IPN', () => {
    const extra: TaxDeduction = {
      id: 'rent',
      name: 'Аренда офиса',
      amount: 200_000,
      description: 'Расходы на аренду',
    }
    const grossIncome = 1_000_000
    const result = TaxCalculatorService.calculate({
      grossIncome,
      regime: 'GENERAL_REGIME',
      additionalDeductions: [extra],
    })
    const totalDed = STANDARD_DEDUCTION_AMOUNT + 200_000
    const taxable = grossIncome - totalDed
    expect(result.totalDeductions).toBe(totalDed)
    expect(result.taxableIncome).toBe(taxable)
    expect(result.incomeTax).toBe(Math.round(taxable * 0.10))
  })

  it('taxableIncome floored at 0 when deductions exceed income', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 30_000,  // less than standard deduction (55 048)
      regime: 'GENERAL_REGIME',
    })
    expect(result.taxableIncome).toBe(0)
    expect(result.incomeTax).toBe(0)
  })

  it('OPV capped at 50 MZP × 12', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 60_000_000,
      regime: 'GENERAL_REGIME',
    })
    expect(result.pensionContribution).toBe(OPV_MAX_BASE * 0.10)
  })

  it('zero income: IPN = 0, SN still computed but offset by OSMS', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 0,
      regime: 'GENERAL_REGIME',
    })
    expect(result.incomeTax).toBe(0)
    expect(result.pensionContribution).toBe(0)
    // SN gross = 94 368, OSMS = 71 400 → SN net = 22 968
    expect(result.socialTax).toBe(Math.max(0, SN_ANNUAL - OSMS))
    expect(result.medicalInsurance).toBe(OSMS)
    expect(result.effectiveRate).toBe(0)
  })

  it('aiOptimizedSavings is always 0 from calculator (set by AI layer)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 5_000_000,
      regime: 'GENERAL_REGIME',
    })
    expect(result.aiOptimizedSavings).toBe(0)
  })
})

// ── Validation ────────────────────────────────────────────────────────────────
describe('TaxCalculatorService — input validation', () => {
  it('throws on negative income', () => {
    expect(() =>
      TaxCalculatorService.calculate({ grossIncome: -1, regime: 'SIMPLIFIED_DECLARATION' }),
    ).toThrow('grossIncome cannot be negative')
  })

  it('throws on months = 0', () => {
    expect(() =>
      TaxCalculatorService.calculate({ grossIncome: 1_000_000, regime: 'ESP', months: 0 }),
    ).toThrow('months must be between 1 and 12')
  })

  it('throws on months > 12', () => {
    expect(() =>
      TaxCalculatorService.calculate({ grossIncome: 1_000_000, regime: 'ESP', months: 13 }),
    ).toThrow('months must be between 1 and 12')
  })

  it('throws on unsupported regime', () => {
    expect(() =>
      TaxCalculatorService.calculate({ grossIncome: 1_000_000, regime: 'UNKNOWN' as never }),
    ).toThrow('Unsupported tax regime: UNKNOWN')
  })
})

// ── Rounding ──────────────────────────────────────────────────────────────────
describe('TaxCalculatorService — rounding to whole Tenge', () => {
  it('all monetary outputs are whole numbers (simplified)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 1_234_567,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    expect(Number.isInteger(result.incomeTax)).toBe(true)
    expect(Number.isInteger(result.socialTax)).toBe(true)
    expect(Number.isInteger(result.pensionContribution)).toBe(true)
    expect(Number.isInteger(result.medicalInsurance)).toBe(true)
    expect(Number.isInteger(result.totalTaxBurden)).toBe(true)
  })

  it('all monetary outputs are whole numbers (general)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 9_876_543,
      regime: 'GENERAL_REGIME',
    })
    expect(Number.isInteger(result.incomeTax)).toBe(true)
    expect(Number.isInteger(result.socialTax)).toBe(true)
    expect(Number.isInteger(result.pensionContribution)).toBe(true)
    expect(Number.isInteger(result.medicalInsurance)).toBe(true)
    expect(Number.isInteger(result.totalTaxBurden)).toBe(true)
  })

  it('all monetary outputs are whole numbers (patent)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 3_333_333,
      regime: 'PATENT',
    })
    expect(Number.isInteger(result.incomeTax)).toBe(true)
    expect(Number.isInteger(result.pensionContribution)).toBe(true)
    expect(Number.isInteger(result.totalTaxBurden)).toBe(true)
  })

  it('all monetary outputs are whole numbers (ESP)', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: 777_777,
      regime: 'ESP',
      months: 7,
    })
    expect(Number.isInteger(result.incomeTax)).toBe(true)
    expect(Number.isInteger(result.totalTaxBurden)).toBe(true)
  })
})

// ── Constants verification ──────────────────────────────────────────────────────
describe('TaxCalculatorService — 2025/2026 constants', () => {
  it('MRP = 3 932 ₸', () => {
    expect(MRP_2025).toBe(3_932)
  })

  it('MZP = 85 000 ₸', () => {
    expect(MZP_2025).toBe(85_000)
  })

  it('standard deduction = 14 MRP = 55 048 ₸', () => {
    expect(STANDARD_DEDUCTION_AMOUNT).toBe(14 * 3_932)
  })

  it('OSMS annual = 5% × 1.4 MZP × 12 = 71 400 ₸', () => {
    expect(OSMS_ANNUAL_AMOUNT).toBe(Math.round(85_000 * 1.4 * 0.05 * 12))
  })

  it('Social Tax annual = 2 MRP × 12 = 94 368 ₸', () => {
    expect(SOCIAL_TAX_ANNUAL).toBe(Math.round(2 * 3_932 * 12))
  })

  it('OPV max annual base = 50 MZP × 12 = 51 000 000 ₸', () => {
    expect(OPV.maxAnnualBase).toBe(85_000 * 50 * 12)
  })
})

// ── Regime transition (different regimes produce correct structure) ──────────
describe('TaxCalculatorService — regime transitions', () => {
  const regimes = ['ESP', 'SIMPLIFIED_DECLARATION', 'PATENT', 'GENERAL_REGIME'] as const
  const grossIncome = 3_000_000

  for (const regime of regimes) {
    it(`${regime}: result has all required fields`, () => {
      const result = TaxCalculatorService.calculate({ grossIncome, regime })
      expect(result.regime).toBe(regime)
      expect(typeof result.grossIncome).toBe('number')
      expect(typeof result.totalDeductions).toBe('number')
      expect(typeof result.taxableIncome).toBe('number')
      expect(typeof result.taxRate).toBe('number')
      expect(typeof result.incomeTax).toBe('number')
      expect(typeof result.socialTax).toBe('number')
      expect(typeof result.pensionContribution).toBe('number')
      expect(typeof result.medicalInsurance).toBe('number')
      expect(typeof result.totalTaxBurden).toBe('number')
      expect(typeof result.effectiveRate).toBe('number')
      expect(typeof result.aiOptimizedSavings).toBe('number')
      expect(Array.isArray(result.deductions)).toBe(true)
    })
  }
})

// ── Maximum social contribution threshold edge cases ────────────────────────
describe('TaxCalculatorService — OPV threshold boundary', () => {
  it('income exactly at OPV cap: no excess', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: OPV_MAX_BASE, // 51 000 000
      regime: 'SIMPLIFIED_DECLARATION',
    })
    expect(result.pensionContribution).toBe(OPV_MAX_BASE * 0.10)
  })

  it('income 1 ₸ above OPV cap: still capped', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: OPV_MAX_BASE + 1,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    expect(result.pensionContribution).toBe(OPV_MAX_BASE * 0.10)
  })

  it('income 1 ₸ below OPV cap: not capped', () => {
    const result = TaxCalculatorService.calculate({
      grossIncome: OPV_MAX_BASE - 1,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    expect(result.pensionContribution).toBe(Math.round((OPV_MAX_BASE - 1) * 0.10))
  })
})
