/**
 * Deep Truth Audit — AI Advisor (Groq-powered)
 *
 * Three-agent verification:
 *   @Math-Validator      — All 2026 financial constants, OPV/SO/OSMS caps
 *   @Tax-Lawyer-RK       — Tax Code article citations, regime transition rules
 *   @Compliance-Officer  — Anti-avoidance guardrails, legal deductions only
 *
 * Goal: 0% hallucination rate on financial constants.
 * Constraint: MRP 2025/2026 = 3 932 KZT (confirmed unchanged).
 */

import { describe, it, expect } from 'vitest'
import {
  MRP_2025,
  MZP_2025,
  OPV,
  OSMS,
  IPN,
  SOCIAL_TAX,
  SIMPLIFIED_DECLARATION,
  PATENT,
  ESP_RATES,
} from 'nalogai-shared/constants/taxRates'
import {
  TaxCalculatorService,
  MRP_2025 as CalcMRP,
  MZP_2025 as CalcMZP,
  OSMS_ANNUAL_AMOUNT,
  SOCIAL_TAX_ANNUAL,
  STANDARD_DEDUCTION_AMOUNT,
} from '../TaxCalculatorService'
import { buildSystemPrompt } from '../../../prompts/systemPrompt'
import { buildAdvicePrompt } from '../../../prompts/advicePrompt'

// ═══════════════════════════════════════════════════════════════════════════════
// @Math-Validator: Financial Constants Verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('@Math-Validator: 2026 MRP = 3 932 KZT Standard', () => {
  // ── Core constant verification ──────────────────────────────────────────────

  it('MRP 2025 must be exactly 3 932 KZT', () => {
    expect(MRP_2025).toBe(3_932)
  })

  it('MRP alias must equal MRP_2025', () => {
    const { MRP } = require('nalogai-shared/constants/taxRates')
    expect(MRP).toBe(3_932)
  })

  it('TaxCalculatorService re-exports the same MRP', () => {
    expect(CalcMRP).toBe(3_932)
    expect(CalcMRP).toBe(MRP_2025)
  })

  it('MZP 2025 must be exactly 85 000 KZT', () => {
    expect(MZP_2025).toBe(85_000)
    expect(CalcMZP).toBe(85_000)
  })

  // ── OPV (Pension) caps ──────────────────────────────────────────────────────

  it('OPV rate must be 10%', () => {
    expect(OPV.rate).toBe(0.10)
  })

  it('OPV min base = 1 MZP = 85 000 KZT', () => {
    expect(OPV.minBase).toBe(85_000)
  })

  it('OPV max monthly base = 50 MZP = 4 250 000 KZT', () => {
    expect(OPV.maxMonthlyBase).toBe(85_000 * 50)
  })

  it('OPV max annual base = 50 MZP × 12 = 51 000 000 KZT', () => {
    expect(OPV.maxAnnualBase).toBe(85_000 * 50 * 12)
  })

  // ── OSMS (Medical Insurance) ────────────────────────────────────────────────

  it('OSMS rate for IP must be 5%', () => {
    expect(OSMS.selfEmployedRate).toBe(0.05)
  })

  it('OSMS base multiplier = 1.4 MZP', () => {
    expect(OSMS.baseMultiplierMZP).toBe(1.4)
  })

  it('OSMS monthly base = 1.4 × 85 000 = 119 000 KZT', () => {
    expect(OSMS.monthlyBase).toBe(85_000 * 1.4)
  })

  it('OSMS monthly amount = 5% × 119 000 = 5 950 KZT', () => {
    const monthly = OSMS.monthlyBase * OSMS.selfEmployedRate
    expect(monthly).toBe(5_950)
  })

  it('OSMS annual amount = 5 950 × 12 = 71 400 KZT', () => {
    expect(OSMS_ANNUAL_AMOUNT).toBe(71_400)
  })

  // ── Social Tax ──────────────────────────────────────────────────────────────

  it('Social Tax for IP = 2 MRP/month = 7 864 KZT/month', () => {
    expect(SOCIAL_TAX.monthlyMRP).toBe(2)
    expect(SOCIAL_TAX.monthlyAmount).toBe(3_932 * 2)
  })

  it('Social Tax annual = 7 864 × 12 = 94 368 KZT', () => {
    expect(SOCIAL_TAX_ANNUAL).toBe(94_368)
  })

  // ── Standard Deduction ──────────────────────────────────────────────────────

  it('Standard deduction = 14 MRP = 55 048 KZT', () => {
    expect(IPN.standardDeductionMRP).toBe(14)
    expect(STANDARD_DEDUCTION_AMOUNT).toBe(14 * 3_932)
    expect(STANDARD_DEDUCTION_AMOUNT).toBe(55_048)
  })

  // ── Simplified Declaration (Form 910) ───────────────────────────────────────

  it('Simplified Declaration rate = 3%', () => {
    expect(SIMPLIFIED_DECLARATION.taxRate).toBe(0.03)
  })

  it('Simplified Declaration max revenue = 24 038 MRP = 94 517 416 KZT', () => {
    expect(SIMPLIFIED_DECLARATION.maxAnnualRevenue).toBe(24_038 * 3_932)
    expect(SIMPLIFIED_DECLARATION.maxAnnualRevenue).toBe(94_517_416)
  })

  it('Simplified Declaration max employees = 30', () => {
    expect(SIMPLIFIED_DECLARATION.maxEmployees).toBe(30)
  })

  // ── Patent (Form 912) ──────────────────────────────────────────────────────

  it('Patent rate = 1%', () => {
    expect(PATENT.taxRate).toBe(0.01)
  })

  it('Patent max revenue = 3 528 MRP = 13 872 096 KZT', () => {
    expect(PATENT.maxAnnualRevenue).toBe(3_528 * 3_932)
    expect(PATENT.maxAnnualRevenue).toBe(13_872_096)
  })

  // ── ESP ─────────────────────────────────────────────────────────────────────

  it('ESP city = 1 MRP/month = 3 932 KZT', () => {
    expect(ESP_RATES.cityMonthlyMRP).toBe(1)
    expect(ESP_RATES.cityMonthlyAmount).toBe(3_932)
  })

  it('ESP rural = 0.5 MRP/month = 1 966 KZT', () => {
    expect(ESP_RATES.ruralMonthlyMRP).toBe(0.5)
    expect(ESP_RATES.ruralMonthlyAmount).toBe(1_966)
  })

  it('ESP max annual revenue = 1 175 MRP = 4 620 100 KZT', () => {
    expect(ESP_RATES.maxAnnualRevenue).toBe(1_175 * 3_932)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// @Math-Validator: IP with 1,500,000 KZT/month income calculation
// ═══════════════════════════════════════════════════════════════════════════════

describe('@Math-Validator: IP monthly income 1,500,000 KZT — Social Payments', () => {
  const monthlyIncome = 1_500_000
  const annualIncome = monthlyIncome * 12 // 18 000 000

  it('Simplified Declaration: 3% on annual income = 540 000 KZT', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: annualIncome,
      regime: 'SIMPLIFIED_DECLARATION',
    })

    // 3% of 18 000 000 = 540 000
    expect(r.incomeTax + r.socialTax).toBe(540_000)
    // Split: 1.5% IPN = 270 000, 1.5% SN = 270 000
    expect(r.incomeTax).toBe(270_000)
    expect(r.socialTax).toBe(270_000)
  })

  it('OPV: 10% of income, capped at 50 MZP annual base', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: annualIncome,
      regime: 'SIMPLIFIED_DECLARATION',
    })

    // 18 000 000 < 51 000 000 (cap), so OPV = 10% × 18 000 000 = 1 800 000
    expect(r.pensionContribution).toBe(1_800_000)
  })

  it('OSMS: 5% × 1.4 MZP × 12 = 71 400 KZT/year', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: annualIncome,
      regime: 'SIMPLIFIED_DECLARATION',
    })

    expect(r.medicalInsurance).toBe(71_400)
  })

  it('Total tax burden = 540 000 + 1 800 000 + 71 400 = 2 411 400 KZT', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: annualIncome,
      regime: 'SIMPLIFIED_DECLARATION',
    })

    expect(r.totalTaxBurden).toBe(2_411_400)
  })

  it('Effective rate = 2 411 400 / 18 000 000 ≈ 13.40%', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: annualIncome,
      regime: 'SIMPLIFIED_DECLARATION',
    })

    expect(r.effectiveRate).toBeCloseTo(2_411_400 / 18_000_000, 4)
  })

  it('OPV cap test: income above 50 MZP annual base', () => {
    // 50 MZP × 12 = 51 000 000 — income at cap
    const r = TaxCalculatorService.calculate({
      grossIncome: 60_000_000, // above cap
      regime: 'SIMPLIFIED_DECLARATION',
    })

    // OPV should be capped at 10% × 51 000 000 = 5 100 000
    expect(r.pensionContribution).toBe(5_100_000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// @Tax-Lawyer-RK: System Prompt Article Citations Audit
// ═══════════════════════════════════════════════════════════════════════════════

describe('@Tax-Lawyer-RK: Tax Code Article Citations', () => {
  const systemPrompt = buildSystemPrompt('ru')

  it('must cite ст. 686 НК РК (Simplified Declaration)', () => {
    expect(systemPrompt).toContain('ст. 686 НК РК')
  })

  it('must cite ст. 685 НК РК (Patent)', () => {
    expect(systemPrompt).toContain('ст. 685 НК РК')
  })

  it('must cite ст. 683 НК РК (Regime transition order)', () => {
    expect(systemPrompt).toContain('ст. 683 НК РК')
  })

  it('must cite ст. 684 НК РК (Special regime conditions)', () => {
    expect(systemPrompt).toContain('ст. 684 НК РК')
  })

  it('must cite ст. 774 НК РК (ESP)', () => {
    expect(systemPrompt).toContain('ст. 774 НК РК')
  })

  it('must cite ст. 337 НК РК (Standard deduction)', () => {
    expect(systemPrompt).toContain('ст. 337 НК РК')
  })

  it('must cite ст. 338 НК РК (Professional deduction)', () => {
    expect(systemPrompt).toContain('ст. 338 НК РК')
  })

  it('must cite ст. 242 НК РК (Expense deductions)', () => {
    expect(systemPrompt).toContain('ст. 242 НК РК')
  })

  it('must cite ст. 353 НК РК (Loss carryforward)', () => {
    expect(systemPrompt).toContain('ст. 353 НК РК')
  })

  it('must cite ст. 355 НК РК (Education/medical deductions)', () => {
    expect(systemPrompt).toContain('ст. 355 НК РК')
  })

  it('must cite ст. 25 Закона об ЕНПФ (OPV)', () => {
    expect(systemPrompt).toContain('ст. 25 Закона об ЕНПФ')
  })

  it('must cite ст. 27 Закона об ОСМС', () => {
    expect(systemPrompt).toContain('ст. 27 Закона об ОСМС')
  })

  it('must contain regime transition section', () => {
    expect(systemPrompt).toContain('ПЕРЕХОД МЕЖДУ РЕЖИМАМИ')
  })

  it('must specify 10 working days deadline for regime transition', () => {
    expect(systemPrompt).toContain('10 рабочих дней')
  })

  it('must reference Patent income limit (3 528 MRP)', () => {
    expect(systemPrompt).toContain('3 528 МРП')
  })

  it('must reference Simplified income limit (24 038 MRP)', () => {
    expect(systemPrompt).toContain('24 038 МРП')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// @Tax-Lawyer-RK: Advice Prompt Article Enforcement
// ═══════════════════════════════════════════════════════════════════════════════

describe('@Tax-Lawyer-RK: Advice Prompt Requires Article References', () => {
  const advicePrompt = buildAdvicePrompt({
    businessType: 'ИП',
    regimeLabel: 'Упрощённая декларация',
    grossIncome: 18_000_000,
    totalExpenses: 5_000_000,
    netIncome: 13_000_000,
    currentTaxBurden: 2_411_400,
    regimeSavings: [],
    ragContext: '',
    language: 'ru',
  })

  it('must require articleRef field in output', () => {
    expect(advicePrompt).toContain('articleRef')
  })

  it('must instruct AI to cite specific НК РК article', () => {
    expect(advicePrompt).toContain('ст. 686 НК РК')
  })

  it('must enforce saving values from pre-computed data only', () => {
    expect(advicePrompt).toContain('ТОЛЬКО эти цифры допустимы')
  })

  it('must include RAG context slot', () => {
    expect(advicePrompt).toContain('КОНТЕКСТ ИЗ НК РК')
  })

  it('must include user financial data', () => {
    expect(advicePrompt).toContain('18 000 000')
    expect(advicePrompt).toContain('5 000 000')
    expect(advicePrompt).toContain('13 000 000')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// @Compliance-Officer: Anti-Avoidance Guardrails
// ═══════════════════════════════════════════════════════════════════════════════

describe('@Compliance-Officer: Anti-Tax-Avoidance Guardrails', () => {
  const systemPrompt = buildSystemPrompt('ru')

  it('must contain anti-avoidance section', () => {
    expect(systemPrompt).toContain('АНТИУКЛОНЕНИЕ И КОМПЛАЕНС')
  })

  it('must cite ст. 245 УК РК (tax evasion criminal offense)', () => {
    expect(systemPrompt).toContain('ст. 245 УК РК')
  })

  it('must explicitly forbid tax evasion schemes', () => {
    expect(systemPrompt).toContain('НИКОГДА не советуй схемы уклонения')
  })

  it('must forbid fictitious expenses', () => {
    expect(systemPrompt).toContain('фиктивными расходами')
  })

  it('must forbid forged documents', () => {
    expect(systemPrompt).toContain('поддельными документами')
  })

  it('must forbid grey optimization schemes', () => {
    expect(systemPrompt).toContain('"серыми" схемами')
  })

  it('must require offering legal alternatives when user asks about zero tax', () => {
    expect(systemPrompt).toContain('ЛЕГАЛЬНЫЕ способы снижения')
  })

  it('must reference legal deduction articles as alternatives', () => {
    expect(systemPrompt).toContain('ст. 337, 338, 355 НК РК')
  })

  it('must mention social responsibility of taxes', () => {
    expect(systemPrompt).toContain('социальную ответственность')
  })

  it('must require reminding about timely declaration filing', () => {
    expect(systemPrompt).toContain('своевременной подачи деклараций')
  })

  it('must require disclaimer on every response', () => {
    expect(systemPrompt).toContain('Никогда не давай юридических гарантий')
  })

  it('must forbid answering questions outside RK tax law', () => {
    expect(systemPrompt).toContain('выходит за рамки налогов РК')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// @Compliance-Officer: Legal Deductions Verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('@Compliance-Officer: Legal Deductions Are Correctly Referenced', () => {
  const systemPrompt = buildSystemPrompt('ru')

  const legalDeductions = [
    { name: 'Standard deduction (14 MRP)', article: 'ст. 337 НК РК', amount: 55_048 },
    { name: 'Professional deduction', article: 'ст. 338 НК РК' },
    { name: 'Expense deductions for IP', article: 'ст. 242 НК РК' },
    { name: 'Loss carryforward (3 years)', article: 'ст. 353 НК РК' },
    { name: 'Education/medical deductions', article: 'ст. 355 НК РК' },
  ]

  for (const deduction of legalDeductions) {
    it(`must reference ${deduction.name} — ${deduction.article}`, () => {
      expect(systemPrompt).toContain(deduction.article)
    })
  }

  it('standard deduction amount must be 14 × 3 932 = 55 048 KZT', () => {
    expect(STANDARD_DEDUCTION_AMOUNT).toBe(55_048)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// @Math-Validator: Cross-verification — constants in prompt vs code
// ═══════════════════════════════════════════════════════════════════════════════

describe('@Math-Validator: Prompt Constants Match Code Constants', () => {
  const systemPrompt = buildSystemPrompt('ru')

  it('prompt must state MRP = 3 932', () => {
    expect(systemPrompt).toContain('3 932')
  })

  it('prompt must state MZP = 85 000', () => {
    expect(systemPrompt).toContain('85 000')
  })

  it('prompt must state OPV = 10%', () => {
    expect(systemPrompt).toContain('10% от дохода')
  })

  it('prompt must state OPV max = 50 МЗП', () => {
    expect(systemPrompt).toContain('50 МЗП')
  })

  it('prompt must state OSMS = 5% от 1.4 МЗП', () => {
    expect(systemPrompt).toContain('5% от 1.4 МЗП')
  })

  it('prompt must state OSMS monthly = 5 950', () => {
    expect(systemPrompt).toContain('5 950')
  })

  it('prompt must state OSMS annual = 71 400', () => {
    expect(systemPrompt).toContain('71 400')
  })

  it('prompt must state Social Tax = 2 МРП/month', () => {
    expect(systemPrompt).toContain('2 МРП/мес')
  })

  it('prompt must state Social Tax annual = 94 368', () => {
    expect(systemPrompt).toContain('94 368')
  })

  it('prompt must state standard deduction = 14 МРП = 55 048', () => {
    expect(systemPrompt).toContain('55 048')
  })

  it('prompt must state ESP city = 1 МРП/мес', () => {
    expect(systemPrompt).toContain('1 МРП/мес')
  })

  it('prompt must state ESP rural = 0.5 МРП/мес', () => {
    expect(systemPrompt).toContain('0.5 МРП/мес')
  })

  it('prompt must state Simplified rate = 3%', () => {
    expect(systemPrompt).toContain('3% от оборота')
  })

  it('prompt must state Patent rate = 1%', () => {
    expect(systemPrompt).toContain('1%')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// @Math-Validator: Edge cases — zero-kopek precision
// ═══════════════════════════════════════════════════════════════════════════════

describe('@Math-Validator: Zero-Kopek Precision Edge Cases', () => {
  it('income exactly at OPV cap (51 000 000)', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: 51_000_000,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    // OPV = 10% × 51 000 000 = 5 100 000 (at cap)
    expect(r.pensionContribution).toBe(5_100_000)
  })

  it('income 1 KZT above OPV cap', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: 51_000_001,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    // OPV still capped at 5 100 000
    expect(r.pensionContribution).toBe(5_100_000)
  })

  it('income 1 KZT — minimal calculation', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: 1,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    // 3% of 1 = 0.03 → rounded to 0
    expect(r.incomeTax + r.socialTax).toBe(0)
  })

  it('income at Simplified max (94 517 416)', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: 94_517_416,
      regime: 'SIMPLIFIED_DECLARATION',
    })
    // 3% of 94 517 416 = 2 835 522.48 → 2 835 522
    expect(r.incomeTax + r.socialTax).toBe(2_835_522)
  })

  it('income at Patent max (13 872 096)', () => {
    const r = TaxCalculatorService.calculate({
      grossIncome: 13_872_096,
      regime: 'PATENT',
    })
    // 1% of 13 872 096 = 138 720.96 → 138 721
    expect(r.incomeTax).toBe(138_721)
  })
})
