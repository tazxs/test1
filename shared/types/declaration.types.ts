/**
 * Declaration (налоговая декларация) types.
 * All monetary values are number (frontend-safe).
 */

import type { TaxRegime } from './user.types'

export type DeclarationStatus =
  | 'DRAFT'      // In progress, not submitted
  | 'READY'      // Calculated, ready to submit
  | 'SUBMITTED'  // Sent to eGov
  | 'ACCEPTED'   // eGov confirmed acceptance
  | 'REJECTED'   // eGov rejected

export type DeclarationPeriodType = 'QUARTER' | 'YEAR' | 'MONTH'

export type DeclarationFormType =
  | 'FORM_200'   // Общий режим ИПН
  | 'FORM_910'   // Упрощённая декларация
  | 'FORM_912'   // Патент
  | 'ESP'        // Единый совокупный платёж

export interface TaxDeduction {
  id: string
  name: string
  amount: number
  description: string
}

export interface TaxCalculationResult {
  grossIncome: number
  totalDeductions: number
  taxableIncome: number
  taxRate: number
  incomeTax: number
  socialTax: number
  pensionContribution: number
  medicalInsurance: number
  totalTaxBurden: number
  effectiveRate: number
  aiOptimizedSavings: number
  deductions: TaxDeduction[]
  regime: TaxRegime
  /** Form 910.00: true when grossIncome = 0 — flags "no activity" on the declaration */
  noActivity?: boolean
}

export interface Declaration {
  id: string
  userId: string
  period: string          // e.g. "2025-Q1", "2025-01"
  periodType: DeclarationPeriodType
  formType: DeclarationFormType
  status: DeclarationStatus
  calculation: TaxCalculationResult | null
  pdfUrl: string | null
  eGovConfirmationCode: string | null
  submittedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateDeclarationPayload {
  period: string
  periodType: DeclarationPeriodType
  formType: DeclarationFormType
}

export interface SubmitDeclarationPayload {
  declarationId: string
}

export interface DeclarationListParams {
  page?: number
  limit?: number
  status?: DeclarationStatus
  year?: number
}
