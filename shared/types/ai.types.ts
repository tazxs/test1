

import type { TransactionCategory } from './transaction.types'

export type AIAdviceType =
  | 'DEDUCTION_OPPORTUNITY'
  | 'REGIME_OPTIMIZATION'
  | 'EXPENSE_CATEGORIZATION'
  | 'DEADLINE_ALERT'
  | 'GENERAL_TIP'

export interface AICategorizationResult {
  category: TransactionCategory
  confidence: number           // 0.0 – 1.0
  reasoning: string
}

export interface AIAdviceTip {
  id: string
  type: AIAdviceType
  title: string
  description: string
  /** Mandatory legal disclaimer — always present, hardcoded server-side */
  disclaimer: string
  potentialSaving: number      // KZT amount
  actionLabel: string
  isApplicable: boolean
  /** NK RK articles cited by the AI, sourced from pgvector RAG search */
  sources?: Array<{ articleNumber: string; title: string }>
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface AIChatResponse {
  message: AIChatMessage
  suggestedQuestions: string[]
  tokensUsed: number
}

export interface AIChatPayload {
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface AIAdvicePayload {
  periodIncome: number
  periodExpenses: number
  regime: string
  businessType: string
}

export interface AICategorizeBulkPayload {
  transactions: Array<{
    id: string
    description: string
    amount: number
    type: 'INCOME' | 'EXPENSE'
  }>
}

export interface AICategorizeBulkResult {
  results: Array<{
    transactionId: string
    category: TransactionCategory
    confidence: number
  }>
}

export interface AIUsageStats {
  tokensUsedThisMonth: number
  requestsThisMonth: number
  monthlyLimit: number
}
