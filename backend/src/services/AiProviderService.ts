/**
 * AiProviderService — provider-agnostic AI abstraction layer.
 *
 * IAiProvider defines the contract every AI backend must implement.
 * Concrete implementations: GeminiService, GroqService.
 * Factory: AIService (switches via AI_PROVIDER env var).
 */

import type { TransactionCategory, TransactionType } from 'nalogai-shared/types/transaction.types'
import type { AIAdviceTip } from 'nalogai-shared/types/ai.types'
import type { RegimeSaving } from '../../prompts/advicePrompt'
import type { SupportedLanguage } from '@utils/language'

// ── Provider contract ─────────────────────────────────────────────────────────

export interface IAiProvider {
  categorize(
    description: string,
    amount: number,
    type: TransactionType,
    language?: SupportedLanguage,
  ): Promise<{ category: TransactionCategory; confidence: number; reasoning: string }>

  categorizeBulk(
    transactions: Array<{ id: string; description: string; amount: number; type: TransactionType }>,
    language?: SupportedLanguage,
  ): Promise<Array<{ transactionId: string; category: TransactionCategory; confidence: number }>>

  getAdvice(params: {
    grossIncome:      number
    totalExpenses:    number
    regime:           string
    businessType:     string
    currentTaxBurden: number
    regimeSavings:    RegimeSaving[]
    ragContext:       string
    language:         SupportedLanguage
  }): Promise<AIAdviceTip[]>

  chat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContext?: string,
    ragContext?: string,
    language?: SupportedLanguage,
  ): Promise<string>

  chatStream(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContext?: string,
    ragContext?: string,
    language?: SupportedLanguage,
  ): AsyncIterable<string>
}

// ── Shared label maps ─────────────────────────────────────────────────────────
// Canonical source — import from here, not from any provider file.

export const REGIME_LABELS: Record<string, string> = {
  SIMPLIFIED_DECLARATION: 'Упрощённая декларация (Форма 910, 3%)',
  PATENT:                 'Патент (Форма 912, 1%)',
  GENERAL_REGIME:         'Общий режим (ИПН 10%)',
  ESP:                    'ЕСП (1 МРП/мес)',
}

export const REGIME_LABELS_BY_LANGUAGE: Record<SupportedLanguage, Record<string, string>> = {
  kk: {
    SIMPLIFIED_DECLARATION: 'оңайлатылған декларация негізіндегі арнаулы салық режимі (910.00 нысаны, 3%)',
    PATENT:                 'патент (912.00 нысаны, 1%)',
    GENERAL_REGIME:         'жалпыға бірдей режим (жеке табыс салығы 10%)',
    ESP:                    'бірыңғай жиынтық төлем (айына 1 АЕК)',
  },
  ru: REGIME_LABELS,
  en: {
    SIMPLIFIED_DECLARATION: 'simplified declaration special tax regime (Form 910, 3%)',
    PATENT:                 'patent regime (Form 912, 1%)',
    GENERAL_REGIME:         'general regime (individual income tax 10%)',
    ESP:                    'single aggregate payment (1 MCI/month)',
  },
}

export const BT_LABELS: Record<string, string> = {
  SELF_EMPLOYED:   'Самозанятый',
  SOLE_PROPRIETOR: 'ИП (Индивидуальный предприниматель)',
  LLC:             'ТОО (Товарищество с ограниченной ответственностью)',
}

export const BT_LABELS_BY_LANGUAGE: Record<SupportedLanguage, Record<string, string>> = {
  kk: {
    SELF_EMPLOYED:   'өзін-өзі жұмыспен қамтыған',
    SOLE_PROPRIETOR: 'жеке кәсіпкер (ЖК)',
    LLC:             'ЖШС',
  },
  ru: BT_LABELS,
  en: {
    SELF_EMPLOYED:   'self-employed',
    SOLE_PROPRIETOR: 'sole proprietor (IP)',
    LLC:             'limited liability partnership (TOO)',
  },
}
