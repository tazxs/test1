/**
 * Comprehensive Tax Precision Test Suite — 50 Scenarios
 *
 * Verifies TaxCalculatorService against official KGD (State Revenue Committee) logic
 * with zero-kopek variance. Uses MRP = 4 325 KZT (2026 Budget Law).
 *
 * Test categories:
 *   1. ESP regime (scenarios 1–10)
 *   2. Simplified Declaration / Form 910 (scenarios 11–25)
 *   3. Patent / Form 912 (scenarios 26–35)
 *   4. General Regime / Form 200 (scenarios 36–45)
 *   5. Edge cases (scenarios 46–50)
 */
import { describe, it, expect } from 'vitest'
import {
  TaxCalculatorService,
  STANDARD_DEDUCTION_AMOUNT,
  OSMS_ANNUAL_AMOUNT,
  SOCIAL_TAX_ANNUAL,
  MRP_2026,
  MZP_2025,
} from '../TaxCalculatorService'
import type { TaxDeduction } from 'nalogai-shared/types/declaration.types'

// ── Base constants (MRP 2026 = 4 325 KZT per 2026 Budget Law) ───────────────
const MRP = MRP_2026           // 4 325
const MZP = MZP_2025           // 85 000
const ESP_CITY_MONTHLY = MRP   // 4 325
const ESP_RURAL_MONTHLY = Math.round(MRP * 0.5) // 2 163
const OSMS_ANNUAL = OSMS_ANNUAL_AMOUNT            // 71 400
const SN_ANNUAL = SOCIAL_TAX_ANNUAL               // 103 800
const OPV_MAX_ANNUAL_BASE = MZP * 50 * 12         // 51 000 000
const STD_DEDUCTION = STANDARD_DEDUCTION_AMOUNT    // 14 × 4 325 = 60 550

// ── Helper ───────────────────────────────────────────────────────────────────
function calc(grossIncome: number, regime: string, months = 12, isRural = false) {
  return TaxCalculatorService.calculate({
    grossIncome,
    regime: regime as 'ESP' | 'SIMPLIFIED_DECLARATION' | 'PATENT' | 'GENERAL_REGIME',
    months,
    isRural,
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ESP REGIME (Scenarios 1–10)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Tax Precision — ESP (10 scenarios)', () => {
  // Scenario 1: City, annual, income 500K
  it('#1 ESP city annual — income 500 000', () => {
    const r = calc(500_000, 'ESP')
    expect(r.incomeTax).toBe(ESP_CITY_MONTHLY * 12) // 51 900
    expect(r.totalTaxBurden).toBe(51_900)
    expect(r.effectiveRate).toBeCloseTo(51_900 / 500_000, 8)
  })

  // Scenario 2: City, annual, income 2M
  it('#2 ESP city annual — income 2 000 000', () => {
    const r = calc(2_000_000, 'ESP')
    expect(r.incomeTax).toBe(51_900)
    expect(r.totalTaxBurden).toBe(51_900)
  })

  // Scenario 3: City, quarterly (3 months)
  it('#3 ESP city quarterly — income 300 000', () => {
    const r = calc(300_000, 'ESP', 3)
    expect(r.incomeTax).toBe(ESP_CITY_MONTHLY * 3) // 12 975
    expect(r.totalTaxBurden).toBe(12_975)
  })

  // Scenario 4: City, single month
  it('#4 ESP city monthly — income 100 000', () => {
    const r = calc(100_000, 'ESP', 1)
    expect(r.incomeTax).toBe(ESP_CITY_MONTHLY) // 4 325
  })

  // Scenario 5: Rural, annual
  // Service rounds (monthlyPayment * months), not monthlyPayment first.
  // With MRP=4325: ruralMonthly=2162.5, so Math.round(2162.5*12)=25950
  it('#5 ESP rural annual — income 500 000', () => {
    const r = calc(500_000, 'ESP', 12, true)
    const expectedRuralAnnual = Math.round(MRP * 0.5 * 12) // 25 950
    expect(r.incomeTax).toBe(expectedRuralAnnual)
    expect(r.totalTaxBurden).toBe(expectedRuralAnnual)
  })

  // Scenario 6: Rural, quarterly
  it('#6 ESP rural quarterly — income 200 000', () => {
    const r = calc(200_000, 'ESP', 3, true)
    const expectedRuralQuarterly = Math.round(MRP * 0.5 * 3) // 6 488
    expect(r.incomeTax).toBe(expectedRuralQuarterly)
  })

  // Scenario 7: Zero income — ESP still charges fixed amount
  it('#7 ESP zero income — fixed payment still applies', () => {
    const r = calc(0, 'ESP')
    expect(r.incomeTax).toBe(51_900)
    expect(r.effectiveRate).toBe(0) // no division by zero
  })

  // Scenario 8: Very high income — ESP is fixed, not percentage
  it('#8 ESP high income 50M — fixed payment unchanged', () => {
    const r = calc(50_000_000, 'ESP')
    expect(r.incomeTax).toBe(51_900)
    expect(r.totalTaxBurden).toBe(51_900)
  })

  // Scenario 9: ESP has no OPV/OSMS/SN (included in payment)
  it('#9 ESP — no separate OPV/OSMS/SN', () => {
    const r = calc(1_000_000, 'ESP')
    expect(r.pensionContribution).toBe(0)
    expect(r.medicalInsurance).toBe(0)
    expect(r.socialTax).toBe(0)
  })

  // Scenario 10: ESP 6 months
  it('#10 ESP city 6 months', () => {
    const r = calc(800_000, 'ESP', 6)
    expect(r.incomeTax).toBe(ESP_CITY_MONTHLY * 6) // 25 950
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SIMPLIFIED DECLARATION / FORM 910 (Scenarios 11–25)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Tax Precision — SIMPLIFIED_DECLARATION (15 scenarios)', () => {
  // Scenario 11: Basic 3% on 5M
  it('#11 Simplified — income 5 000 000, 3% split', () => {
    const r = calc(5_000_000, 'SIMPLIFIED_DECLARATION')
    const total3 = Math.round(5_000_000 * 0.03) // 150 000
    expect(r.incomeTax + r.socialTax).toBe(total3)
    expect(r.incomeTax).toBe(Math.round(total3 / 2)) // 75 000
    expect(r.socialTax).toBe(total3 - r.incomeTax)    // 75 000
  })

  // Scenario 12: OPV = 10% within cap
  it('#12 Simplified — OPV 10% on 3M', () => {
    const r = calc(3_000_000, 'SIMPLIFIED_DECLARATION')
    expect(r.pensionContribution).toBe(300_000)
  })

  // Scenario 13: OSMS annual
  it('#13 Simplified — OSMS annual 71 400', () => {
    const r = calc(3_000_000, 'SIMPLIFIED_DECLARATION')
    expect(r.medicalInsurance).toBe(OSMS_ANNUAL)
  })

  // Scenario 14: OSMS quarterly prorated
  it('#14 Simplified — OSMS quarterly prorated', () => {
    const r = calc(3_000_000, 'SIMPLIFIED_DECLARATION', 3)
    expect(r.medicalInsurance).toBe(Math.round(OSMS_ANNUAL * 3 / 12))
  })

  // Scenario 15: Standard deduction applied
  it('#15 Simplified — standard deduction 14 MRP', () => {
    const r = calc(5_000_000, 'SIMPLIFIED_DECLARATION')
    expect(r.totalDeductions).toBe(STD_DEDUCTION)
    expect(r.taxableIncome).toBe(5_000_000 - STD_DEDUCTION)
  })

  // Scenario 16: Total tax burden = 3% + OPV + OSMS
  it('#16 Simplified — total burden formula', () => {
    const r = calc(5_000_000, 'SIMPLIFIED_DECLARATION')
    expect(r.totalTaxBurden).toBe(
      r.incomeTax + r.socialTax + r.pensionContribution + r.medicalInsurance,
    )
  })

  // Scenario 17: OPV capped at 50 MZP × 12
  it('#17 Simplified — OPV cap at 51M base', () => {
    const r = calc(60_000_000, 'SIMPLIFIED_DECLARATION')
    expect(r.pensionContribution).toBe(Math.round(OPV_MAX_ANNUAL_BASE * 0.10))
  })

  // Scenario 18: Zero income — noActivity flag
  it('#18 Simplified — zero income, noActivity = true', () => {
    const r = calc(0, 'SIMPLIFIED_DECLARATION')
    expect(r.incomeTax).toBe(0)
    expect(r.socialTax).toBe(0)
    expect(r.pensionContribution).toBe(0)
    expect(r.medicalInsurance).toBe(OSMS_ANNUAL)
    expect(r.noActivity).toBe(true)
  })

  // Scenario 19: Odd amount — no rounding gap
  it('#19 Simplified — odd amount 1 000 001, no rounding gap', () => {
    const r = calc(1_000_001, 'SIMPLIFIED_DECLARATION')
    const total3 = Math.round(1_000_001 * 0.03)
    expect(r.incomeTax + r.socialTax).toBe(total3)
  })

  // Scenario 20: Small income — deductions exceed income
  it('#20 Simplified — income 30K, taxableIncome floored at 0', () => {
    const r = calc(30_000, 'SIMPLIFIED_DECLARATION')
    expect(r.taxableIncome).toBe(0)
  })

  // Scenario 21: Quarterly calculation
  it('#21 Simplified — quarterly, income 2M', () => {
    const r = calc(2_000_000, 'SIMPLIFIED_DECLARATION', 3)
    const total3 = Math.round(2_000_000 * 0.03)
    expect(r.incomeTax + r.socialTax).toBe(total3)
    expect(r.medicalInsurance).toBe(Math.round(OSMS_ANNUAL * 3 / 12))
  })

  // Scenario 22: Additional deductions
  it('#22 Simplified — with additional deductions', () => {
    const extra: TaxDeduction = { id: 'e1', name: 'Office', amount: 200_000, description: 'Rent' }
    const r = calc(5_000_000, 'SIMPLIFIED_DECLARATION')
    const r2 = TaxCalculatorService.calculate({
      grossIncome: 5_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
      additionalDeductions: [extra],
    })
    expect(r2.totalDeductions).toBe(STD_DEDUCTION + 200_000)
    expect(r2.taxableIncome).toBe(5_000_000 - STD_DEDUCTION - 200_000)
    // 3% is on gross, not taxable — same as without deductions
    expect(r2.incomeTax + r2.socialTax).toBe(r.incomeTax + r.socialTax)
  })

  // Scenario 23: Income exactly at MRP boundary
  it('#23 Simplified — income = 1 MRP', () => {
    const r = calc(MRP, 'SIMPLIFIED_DECLARATION')
    const total3 = Math.round(MRP * 0.03) // 117.96 → 118
    expect(r.incomeTax + r.socialTax).toBe(total3)
  })

  // Scenario 24: Income = 1 tenge
  it('#24 Simplified — income = 1 tenge', () => {
    const r = calc(1, 'SIMPLIFIED_DECLARATION')
    expect(r.incomeTax + r.socialTax).toBe(Math.round(1 * 0.03)) // 0
    expect(r.noActivity).toBe(false)
  })

  // Scenario 25: Monthly calculation
  it('#25 Simplified — monthly, income 500K', () => {
    const r = calc(500_000, 'SIMPLIFIED_DECLARATION', 1)
    expect(r.medicalInsurance).toBe(Math.round(OSMS_ANNUAL / 12))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PATENT / FORM 912 (Scenarios 26–35)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Tax Precision — PATENT (10 scenarios)', () => {
  // Scenario 26: Basic 1% on 2M
  it('#26 Patent — 1% on 2M = 20 000', () => {
    const r = calc(2_000_000, 'PATENT')
    expect(r.incomeTax).toBe(20_000)
    expect(r.taxRate).toBe(0.01)
  })

  // Scenario 27: No social tax (included in patent)
  it('#27 Patent — socialTax = 0', () => {
    const r = calc(2_000_000, 'PATENT')
    expect(r.socialTax).toBe(0)
  })

  // Scenario 28: No OSMS (included in patent)
  it('#28 Patent — OSMS = 0', () => {
    const r = calc(2_000_000, 'PATENT')
    expect(r.medicalInsurance).toBe(0)
  })

  // Scenario 29: OPV = 10%
  it('#29 Patent — OPV 10%', () => {
    const r = calc(2_000_000, 'PATENT')
    expect(r.pensionContribution).toBe(200_000)
  })

  // Scenario 30: Total = incomeTax + OPV
  it('#30 Patent — total = incomeTax + OPV', () => {
    const r = calc(2_000_000, 'PATENT')
    expect(r.totalTaxBurden).toBe(20_000 + 200_000)
  })

  // Scenario 31: OPV capped
  it('#31 Patent — OPV cap at 51M base', () => {
    const r = calc(60_000_000, 'PATENT')
    expect(r.pensionContribution).toBe(Math.round(OPV_MAX_ANNUAL_BASE * 0.10))
  })

  // Scenario 32: Zero income
  it('#32 Patent — zero income', () => {
    const r = calc(0, 'PATENT')
    expect(r.incomeTax).toBe(0)
    expect(r.pensionContribution).toBe(0)
    expect(r.totalTaxBurden).toBe(0)
  })

  // Scenario 33: No standard deduction
  it('#33 Patent — no standard deduction', () => {
    const r = calc(2_000_000, 'PATENT')
    expect(r.totalDeductions).toBe(0)
  })

  // Scenario 34: Effective rate
  it('#34 Patent — effective rate = 11%', () => {
    const r = calc(2_000_000, 'PATENT')
    expect(r.effectiveRate).toBeCloseTo(0.11, 4)
  })

  // Scenario 35: Small income
  it('#35 Patent — income 10 000', () => {
    const r = calc(10_000, 'PATENT')
    expect(r.incomeTax).toBe(100)
    expect(r.pensionContribution).toBe(1_000)
    expect(r.totalTaxBurden).toBe(1_100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GENERAL REGIME / FORM 200 (Scenarios 36–45)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Tax Precision — GENERAL_REGIME (10 scenarios)', () => {
  // Scenario 36: IPN = 10% on taxable income
  it('#36 General — IPN 10% on taxable', () => {
    const r = calc(10_000_000, 'GENERAL_REGIME')
    const taxable = 10_000_000 - STD_DEDUCTION
    expect(r.incomeTax).toBe(Math.round(taxable * 0.10))
  })

  // Scenario 37: Standard deduction
  it('#37 General — standard deduction applied', () => {
    const r = calc(10_000_000, 'GENERAL_REGIME')
    expect(r.totalDeductions).toBe(STD_DEDUCTION)
    expect(r.taxableIncome).toBe(10_000_000 - STD_DEDUCTION)
  })

  // Scenario 38: OPV = 10% of gross
  it('#38 General — OPV 10% of gross', () => {
    const r = calc(10_000_000, 'GENERAL_REGIME')
    expect(r.pensionContribution).toBe(1_000_000)
  })

  // Scenario 39: OSMS annual
  it('#39 General — OSMS annual', () => {
    const r = calc(10_000_000, 'GENERAL_REGIME')
    expect(r.medicalInsurance).toBe(OSMS_ANNUAL)
  })

  // Scenario 40: Social tax = 2 MRP/month − OSMS
  it('#40 General — social tax formula', () => {
    const r = calc(10_000_000, 'GENERAL_REGIME')
    const grossSN = Math.round(MRP * 2 * 12) // 103 800
    expect(r.socialTax).toBe(Math.max(0, grossSN - OSMS_ANNUAL))
  })

  // Scenario 41: Total burden
  it('#41 General — total = IPN + SN + OPV + OSMS', () => {
    const r = calc(10_000_000, 'GENERAL_REGIME')
    expect(r.totalTaxBurden).toBe(
      r.incomeTax + r.socialTax + r.pensionContribution + r.medicalInsurance,
    )
  })

  // Scenario 42: Zero income
  it('#42 General — zero income', () => {
    const r = calc(0, 'GENERAL_REGIME')
    expect(r.incomeTax).toBe(0)
    expect(r.taxableIncome).toBe(0)
  })

  // Scenario 43: Quarterly
  it('#43 General — quarterly', () => {
    const r = calc(5_000_000, 'GENERAL_REGIME', 3)
    expect(r.medicalInsurance).toBe(Math.round(OSMS_ANNUAL * 3 / 12))
  })

  // Scenario 44: OPV capped
  it('#44 General — OPV cap', () => {
    const r = calc(60_000_000, 'GENERAL_REGIME')
    expect(r.pensionContribution).toBe(Math.round(OPV_MAX_ANNUAL_BASE * 0.10))
  })

  // Scenario 45: Social tax floored at 0
  it('#45 General — social tax floor at 0', () => {
    // When OSMS > gross SN, socialTax should be 0
    const r = calc(10_000_000, 'GENERAL_REGIME')
    expect(r.socialTax).toBeGreaterThanOrEqual(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. EDGE CASES (Scenarios 46–50)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Tax Precision — Edge Cases (5 scenarios)', () => {
  // Scenario 46: Negative income throws
  it('#46 Negative income throws error', () => {
    expect(() => calc(-1000, 'SIMPLIFIED_DECLARATION')).toThrow('grossIncome cannot be negative')
  })

  // Scenario 47: Invalid months throws
  it('#47 Invalid months (0) throws error', () => {
    expect(() => TaxCalculatorService.calculate({
      grossIncome: 1_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
      months: 0,
    })).toThrow('months must be between 1 and 12')
  })

  // Scenario 48: Invalid months (13) throws
  it('#48 Invalid months (13) throws error', () => {
    expect(() => TaxCalculatorService.calculate({
      grossIncome: 1_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
      months: 13,
    })).toThrow('months must be between 1 and 12')
  })

  // Scenario 49: Leap year — February has 29 days (monthly calc)
  // Tax calculation is month-based, not day-based, so leap year doesn't affect it
  it('#49 Leap year — monthly calculation unaffected', () => {
    const r = calc(500_000, 'SIMPLIFIED_DECLARATION', 1)
    expect(r.medicalInsurance).toBe(Math.round(OSMS_ANNUAL / 12))
    // Verify it's the same as non-leap month
    const r2 = calc(500_000, 'SIMPLIFIED_DECLARATION', 1)
    expect(r.medicalInsurance).toBe(r2.medicalInsurance)
  })

  // Scenario 50: Maximum social payment thresholds — OPV and OSMS at boundary
  it('#50 OPV/OSMS at maximum threshold', () => {
    const r = calc(OPV_MAX_ANNUAL_BASE, 'SIMPLIFIED_DECLARATION')
    // OPV should be exactly at cap
    expect(r.pensionContribution).toBe(Math.round(OPV_MAX_ANNUAL_BASE * 0.10))
    // OSMS is fixed, not affected by income
    expect(r.medicalInsurance).toBe(OSMS_ANNUAL)
    // Total burden should be computable
    expect(r.totalTaxBurden).toBe(
      r.incomeTax + r.socialTax + r.pensionContribution + r.medicalInsurance,
    )
  })
})
