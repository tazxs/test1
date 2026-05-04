/**
 * Kazakhstan tax rates and thresholds.
 * All monetary values in KZT.
 * Updated for 2026 tax year per 2026 Kazakhstan Budget Law.
 *
 * NOTE: MRP 2025 = 3 932 KZT (Закон РК от 02.12.2024 №143-VIII).
 * NOTE: MRP 2026 = 4 325 KZT (2026 Kazakhstan Budget Law — official KGD standard).
 * All downstream calculations derive from these base constants.
 */

// ── Базовые показатели ────────────────────────────────────────────────────────
/** Месячный расчётный показатель (МРП) 2025 — 3 932 KZT */
export const MRP_2025 = 3_932
/** Месячный расчётный показатель (МРП) 2026 — 4 325 KZT (2026 Budget Law) */
export const MRP_2026 = 4_325
/** Alias for current tax year (2026) */
export const MRP = MRP_2026

/** Минимальная заработная плата (МЗП) 2025 */
export const MZP_2025 = 85_000
/** Alias for current tax year */
export const MZP = MZP_2025

/** 1 МЗП в год */
export const ANNUAL_MZP_2025 = MZP_2025 * 12

// ── Упрощённая декларация (Форма 910) ────────────────────────────────────────
export const SIMPLIFIED_DECLARATION = {
  /** Ставка ИПН: 3% с оборота */
  taxRate: 0.03,
  /** Максимальный доход для применения режима: 24 038 МРП */
  maxAnnualRevenue: 24_038 * MRP,
  /** Максимальное количество сотрудников */
  maxEmployees: 30,
  /** Отчётный период: квартал */
  period: 'QUARTER' as const,
} as const

// ── Единый совокупный платёж (ЕСП) ───────────────────────────────────────────
export const ESP_RATES = {
  /** Ставка для городов: 1 МРП в месяц */
  cityMonthlyMRP: 1,
  /** Ставка для сельской местности: 0.5 МРП в месяц */
  ruralMonthlyMRP: 0.5,
  /** Максимальный годовой доход: 1175 МРП */
  maxAnnualRevenueMRP: 1175,
  get maxAnnualRevenue() {
    return this.maxAnnualRevenueMRP * MRP
  },
  get cityMonthlyAmount() {
    return this.cityMonthlyMRP * MRP
  },
  get ruralMonthlyAmount() {
    return this.ruralMonthlyMRP * MRP
  },
} as const

// ── Патент (Форма 912) ────────────────────────────────────────────────────────
export const PATENT = {
  /** Ставка: 1% с заявленного дохода */
  taxRate: 0.01,
  /** Максимальный доход: 3 528 МРП в год */
  maxAnnualRevenueMRP: 3_528,
  get maxAnnualRevenue() {
    return this.maxAnnualRevenueMRP * MRP
  },
} as const

// ── Обязательные пенсионные взносы (ОПВ) ─────────────────────────────────────
export const OPV = {
  /** Ставка: 10% от дохода */
  rate: 0.10,
  /** Минимальная база: 1 МЗП */
  get minBase() { return MZP_2025 },
  /** Максимальная база: 50 МЗП */
  get maxMonthlyBase() { return MZP_2025 * 50 },
  get maxAnnualBase() { return MZP_2025 * 50 * 12 },
} as const

// ── Обязательное медицинское страхование (ОСМС) ───────────────────────────────
export const OSMS = {
  /** Ставка взносов для ИП: 5% */
  selfEmployedRate: 0.05,
  /** Ставка взносов для самозанятых через ЕСП включена в платёж */
  espIncluded: true,
  /** Объект обложения: кратно МЗП */
  baseMultiplierMZP: 1.4,
  get monthlyBase() { return MZP_2025 * this.baseMultiplierMZP },
  get annualAmount() { return this.monthlyBase * this.selfEmployedRate * 12 },
} as const

// ── ИПН (Индивидуальный подоходный налог) ─────────────────────────────────────
export const IPN = {
  /** Ставка для физических лиц: 10% */
  standardRate: 0.10,
  /** Стандартный налоговый вычет: 14 МРП на год */
  standardDeductionMRP: 14,
  get standardDeductionAmount() { return this.standardDeductionMRP * MRP },
} as const

// ── Социальный налог (СН) ─────────────────────────────────────────────────────
export const SOCIAL_TAX = {
  /** Ставка для ИП: 2 МРП в месяц */
  monthlyMRP: 2,
  get monthlyAmount() { return this.monthlyMRP * MRP },
  get annualAmount() { return this.monthlyAmount * 12 },
} as const

// ── Сроки сдачи деклараций ────────────────────────────────────────────────────
export const TAX_DEADLINES_BY_QUARTER: Record<string, string> = {
  'Q1': '05-15', // 15 мая
  'Q2': '08-15', // 15 августа
  'Q3': '11-15', // 15 ноября
  'Q4': '02-15', // 15 февраля следующего года
}
