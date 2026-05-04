# Deep Truth Audit Report — AI Advisor (Groq-powered)

**Date:** 2026-05-02  
**Constraint:** 0% hallucination rate on financial constants  
**Standard:** MRP 2025/2026 = 3 932 KZT (Закон РК от 02.12.2024 №143-VIII)  
**Agents:** @Math-Validator, @Tax-Lawyer-RK, @Compliance-Officer

---

## Executive Summary

| Metric | Before Audit | After Audit |
|--------|-------------|-------------|
| MRP references in prompts | "2025" only | "2025–2026" (confirmed unchanged) |
| Tax Code articles cited | 8 articles | 12 articles (+4 regime transition) |
| Anti-avoidance guardrails | None | Full section with ст. 245 УК РК |
| Financial constants in prompt | Partial | Complete (OPV caps, OSMS, SN, deductions) |
| Deviation from 3 932 KZT | 0 | 0 |

---

## @Math-Validator: Financial Constants Verification

### Core Constants — ZERO DEVIATION ✅

| Constant | Expected | Code Value | Prompt Value | Status |
|----------|----------|------------|--------------|--------|
| MRP 2025/2026 | 3 932 KZT | `MRP_2025 = 3_932` | "3 932 ₸" | ✅ Match |
| MZP 2025 | 85 000 KZT | `MZP_2025 = 85_000` | "85 000 ₸" | ✅ Match |
| OPV rate | 10% | `OPV.rate = 0.10` | "10% от дохода" | ✅ Match |
| OPV min base | 1 MZP = 85 000 | `OPV.minBase = 85_000` | "мин. база = 1 МЗП" | ✅ Match |
| OPV max base | 50 MZP = 4 250 000/mo | `OPV.maxMonthlyBase = 4_250_000` | "макс. база = 50 МЗП" | ✅ Match |
| OSMS rate | 5% | `OSMS.selfEmployedRate = 0.05` | "5% от 1.4 МЗП" | ✅ Match |
| OSMS base | 1.4 MZP = 119 000/mo | `OSMS.monthlyBase = 119_000` | "119 000" | ✅ Match |
| OSMS monthly | 5 950 KZT | `119_000 × 0.05 = 5_950` | "5 950 ₸/мес" | ✅ Match |
| OSMS annual | 71 400 KZT | `OSMS_ANNUAL_AMOUNT = 71_400` | "71 400 ₸/год" | ✅ Match |
| Social Tax | 2 MRP/mo = 7 864 | `SOCIAL_TAX.monthlyAmount = 7_864` | "2 МРП/мес" | ✅ Match |
| Social Tax annual | 94 368 KZT | `SOCIAL_TAX_ANNUAL = 94_368` | "94 368 ₸/год" | ✅ Match |
| Standard deduction | 14 MRP = 55 048 | `STANDARD_DEDUCTION_AMOUNT = 55_048` | "55 048 ₸/год" | ✅ Match |
| Simplified rate | 3% | `SIMPLIFIED_DECLARATION.taxRate = 0.03` | "3% от оборота" | ✅ Match |
| Simplified max | 24 038 MRP = 94 517 416 | `24_038 × 3_932 = 94_517_416` | "24 038 МРП" | ✅ Match |
| Patent rate | 1% | `PATENT.taxRate = 0.01` | "1%" | ✅ Match |
| Patent max | 3 528 MRP = 13 872 096 | `3_528 × 3_932 = 13_872_096` | "3 528 МРП" | ✅ Match |
| ESP city | 1 MRP/mo = 3 932 | `ESP_RATES.cityMonthlyAmount = 3_932` | "1 МРП/мес" | ✅ Match |
| ESP rural | 0.5 MRP/mo = 1 966 | `ESP_RATES.ruralMonthlyAmount = 1_966` | "0.5 МРП/мес" | ✅ Match |

### IP with 1,500,000 KZT/month — Social Payments Calculation

| Component | Formula | Expected | TaxCalculatorService | Status |
|-----------|---------|----------|---------------------|--------|
| Annual income | 1,500,000 × 12 | 18,000,000 | 18,000,000 | ✅ |
| IPN (1.5%) | 18,000,000 × 0.015 | 270,000 | 270,000 | ✅ |
| Social Tax (1.5%) | 18,000,000 × 0.015 | 270,000 | 270,000 | ✅ |
| Total 3% | IPN + SN | 540,000 | 540,000 | ✅ |
| OPV (10%) | 18,000,000 × 0.10 | 1,800,000 | 1,800,000 | ✅ |
| OSMS | 5% × 119,000 × 12 | 71,400 | 71,400 | ✅ |
| **Total burden** | 540,000 + 1,800,000 + 71,400 | **2,411,400** | **2,411,400** | ✅ |
| Effective rate | 2,411,400 / 18,000,000 | 13.40% | 13.40% | ✅ |

### OPV Cap Verification

| Scenario | Income | OPV Base | Expected OPV | Status |
|----------|--------|----------|-------------|--------|
| Below cap | 18,000,000 | 18,000,000 | 1,800,000 | ✅ |
| At cap | 51,000,000 | 51,000,000 | 5,100,000 | ✅ |
| Above cap | 60,000,000 | 51,000,000 (capped) | 5,100,000 | ✅ |

---

## @Tax-Lawyer-RK: Article Citations Audit

### Articles in System Prompt — BEFORE vs AFTER

| Article | Topic | Before | After | Status |
|---------|-------|--------|-------|--------|
| ст. 686 НК РК | Simplified Declaration | ✅ | ✅ | Maintained |
| ст. 685 НК РК | Patent | ✅ | ✅ | Maintained |
| ст. 683 НК РК | Regime transition order | ❌ Missing | ✅ Added | **Fixed** |
| ст. 684 НК РК | Special regime conditions | ❌ Missing | ✅ Added | **Fixed** |
| ст. 774 НК РК | ESP | ✅ | ✅ | Maintained |
| ст. 337 НК РК | Standard deduction | ✅ | ✅ | Maintained |
| ст. 338 НК РК | Professional deduction | ✅ | ✅ | Maintained |
| ст. 242 НК РК | Expense deductions | ✅ | ✅ | Maintained |
| ст. 353 НК РК | Loss carryforward | ❌ Missing | ✅ Added | **Fixed** |
| ст. 355 НК РК | Education/medical deductions | ❌ Missing | ✅ Added | **Fixed** |
| ст. 25 Закона об ЕНПФ | OPV | ✅ | ✅ | Maintained |
| ст. 27 Закона об ОСМС | OSMS | ✅ | ✅ | Maintained |

### Regime Transition Rules — NEW SECTION

Per ст. 683, 684, 686 НК РК, the following rules are now embedded in the system prompt:

| Transition | Deadline | Conditions |
|-----------|----------|------------|
| Patent → Simplified | 10 working days before new half-year | Income ≤ 24,038 MRP/year |
| Simplified → Patent | 10 working days before new period | Income ≤ 3,528 MRP/year, eligible activity |
| Any → General | Start of calendar year | No income limit |

---

## @Compliance-Officer: Anti-Avoidance Guardrails

### New Guardrails Added to System Prompt

| Rule | Description | Legal Basis |
|------|-------------|-------------|
| Rule 8 | NEVER advise tax evasion schemes | ст. 245 УК РК |
| Rule 9 | When asked "how to pay zero tax": refuse, explain criminal liability, offer legal alternatives | ст. 245 УК РК, ст. 337, 338, 355 НК РК |
| Rule 10 | Do not help with fictitious expenses or forged documents | ст. 245 УК РК |
| Rule 11 | Always remind about timely declaration filing | ст. 686 НК РК |

### Legal Alternatives Offered Instead of Tax Evasion

| Alternative | Article | Description |
|-------------|---------|-------------|
| Standard deduction | ст. 337 НК РК | 14 MRP = 55,048 KZT/year |
| Professional deduction | ст. 338 НК РК | Business expenses for IP |
| Regime optimization | ст. 683 НК РК | Switch to more favorable regime |
| Expense optimization | ст. 242 НК РК | Legitimate business expense deductions |
| Loss carryforward | ст. 353 НК РК | Carry losses up to 3 years |
| Education/medical | ст. 355 НК РК | Personal deductions |

---

## Files Modified

| File | Changes |
|------|---------|
| [`systemPrompt.ts`](nalogai/backend/prompts/systemPrompt.ts) | +4 Tax Code articles, +regime transition section, +anti-avoidance guardrails (rules 8-11), +complete financial constants block, +2026 MRP reference |
| [`advicePrompt.ts`](nalogai/backend/prompts/advicePrompt.ts) | Updated Kazakh language instruction to reference "2025–2026" MRP |
| [`DeepTruthAudit.test.ts`](nalogai/backend/src/services/__tests__/DeepTruthAudit.test.ts) | **New:** 60+ test cases across 3 agent suites |

---

## Deviation Report: 3 932 KZT MRP Standard

**Result: ZERO DEVIATION**

All financial constants across the codebase (`taxRates.ts`, `TaxCalculatorService.ts`, `systemPrompt.ts`, `advicePrompt.ts`) consistently use MRP = 3,932 KZT. The `TaxPrecision50.test.ts` suite (50 scenarios) and the new `DeepTruthAudit.test.ts` suite (60+ scenarios) both verify this standard with zero-kopek variance.

The only change made was updating the year reference from "2025" to "2025–2026" to reflect that MRP has been officially confirmed unchanged for 2026.
