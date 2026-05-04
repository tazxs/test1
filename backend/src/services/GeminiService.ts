import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { z } from 'zod'
import type { TransactionCategory, TransactionType } from 'nalogai-shared/types/transaction.types'
import type { AIAdviceTip, AIAdviceType } from 'nalogai-shared/types/ai.types'
import { logger } from '@utils/logger'
import { InternalError, RateLimitError } from '@utils/errors'
import { buildSystemPrompt, LOCALIZED_ACTION_LABELS, LOCALIZED_LEGAL_DISCLAIMER } from '../../prompts/systemPrompt'
import { buildAdvicePrompt } from '../../prompts/advicePrompt'
import { buildCategorizationPrompt, buildBulkCategorizationPrompt } from '../../prompts/categorizationPrompt'
import type { RegimeSaving } from '../../prompts/advicePrompt'
import type { IAiProvider } from './AiProviderService'
import { BT_LABELS_BY_LANGUAGE, REGIME_LABELS_BY_LANGUAGE } from './AiProviderService'
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@utils/language'

// ── Zod schemas for validating Gemini JSON output ─────────────────────────────

const VALID_CATEGORIES: [TransactionCategory, ...TransactionCategory[]] = [
  'SERVICES_INCOME', 'GOODS_INCOME', 'RENT_INCOME', 'CONSULTING_INCOME', 'FREELANCE_INCOME',
  'DIVIDEND_INCOME', 'INTEREST_INCOME', 'ASSET_SALE_INCOME', 'OTHER_INCOME',
  'OFFICE_EXPENSES', 'EQUIPMENT_EXPENSES', 'MARKETING_EXPENSES', 'SALARY_EXPENSES',
  'TRANSPORT_EXPENSES', 'UTILITIES_EXPENSES', 'INSURANCE_EXPENSES', 'TAX_EXPENSES',
  'BANK_EXPENSES', 'REPAIR_EXPENSES', 'SUBSCRIPTION_EXPENSES', 'OTHER_EXPENSES',
  'UNCATEGORIZED',
]

const CategorizationSchema = z.object({
  category:   z.enum(VALID_CATEGORIES),
  confidence: z.number().min(0).max(1),
  reasoning:  z.string().optional(),
})

const AdviceTipRawSchema = z.object({
  title:       z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  saving:      z.number().nonnegative(),
  type:        z.enum(['DEDUCTION_OPPORTUNITY', 'REGIME_OPTIMIZATION', 'EXPENSE_CATEGORIZATION', 'GENERAL_TIP'])
               .default('GENERAL_TIP'),
  articleRef:  z.string().min(1).max(80).optional(),  // e.g. "ст. 686 НК РК"
})

const AdviceArraySchema = z.array(AdviceTipRawSchema).min(1).max(5)

// ── Service ───────────────────────────────────────────────────────────────────
export class GeminiService implements IAiProvider {
  private model: GenerativeModel

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

    const modelName = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'
    const genAI = new GoogleGenerativeAI(apiKey)
    this.model = genAI.getGenerativeModel({ model: modelName })
  }

  // ── Single transaction categorization ───────────────────────────────────────
  async categorize(
    description: string,
    amount: number,
    type: TransactionType,
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): Promise<{ category: TransactionCategory; confidence: number; reasoning: string }> {
    const prompt = buildCategorizationPrompt(description, amount, type as 'INCOME' | 'EXPENSE', language)
    const raw = await this.generate(prompt)
    const parsed = this.parseJson(raw, CategorizationSchema)

    return {
      category:   parsed.category,
      confidence: parsed.confidence,
      reasoning:  parsed.reasoning ?? '',
    }
  }

  // ── Bulk categorization ──────────────────────────────────────────────────────
  async categorizeBulk(
    transactions: Array<{ id: string; description: string; amount: number; type: TransactionType }>,
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): Promise<Array<{ transactionId: string; category: TransactionCategory; confidence: number }>> {
    const prompt = buildBulkCategorizationPrompt(
      transactions.map((t) => ({ ...t, type: t.type as 'INCOME' | 'EXPENSE' })),
      language,
    )

    const BulkSchema = z.array(z.object({
      transactionId: z.string(),
      category:      z.enum(VALID_CATEGORIES),
      confidence:    z.number().min(0).max(1),
    }))

    const raw = await this.generate(prompt)
    return this.parseJson(raw, BulkSchema)
  }

  // ── Tax optimization advice ──────────────────────────────────────────────────
  /**
   * @param ragContext  Pre-fetched NK RK article text from RagService (may be empty string)
   * @param regimeSavings  Pre-computed savings from TaxCalculatorService (anti-hallucination)
   * @param currentTaxBurden  Exact current tax from TaxCalculatorService
   */
  async getAdvice(params: {
    grossIncome:      number
    totalExpenses:    number
    regime:           string
    businessType:     string
    currentTaxBurden: number
    regimeSavings:    RegimeSaving[]
    ragContext:       string
    language:         SupportedLanguage
  }): Promise<AIAdviceTip[]> {
    const netIncome = params.grossIncome - params.totalExpenses
    const regimeLabel = REGIME_LABELS_BY_LANGUAGE[params.language][params.regime] ?? params.regime
    const actionLabels = LOCALIZED_ACTION_LABELS[params.language]

    const adviceBody = buildAdvicePrompt({
      businessType:     BT_LABELS_BY_LANGUAGE[params.language][params.businessType] ?? params.businessType,
      regimeLabel,
      grossIncome:      params.grossIncome,
      totalExpenses:    params.totalExpenses,
      netIncome,
      currentTaxBurden: params.currentTaxBurden,
      regimeSavings:    params.regimeSavings,
      ragContext:       params.ragContext,
      language:         params.language,
    })

    const prompt = `${buildSystemPrompt(params.language)}\n\n${adviceBody}`
    const raw = await this.generate(prompt)
    const rawTips = this.parseJson(raw, AdviceArraySchema)

    return rawTips.map((tip, i) => ({
      id:              `ai_tip_${Date.now()}_${i}`,
      type:            tip.type as AIAdviceType,
      title:           tip.title,
      description:     tip.description,
      disclaimer:      LOCALIZED_LEGAL_DISCLAIMER[params.language],
      potentialSaving: tip.saving,
      actionLabel:     tip.type === 'REGIME_OPTIMIZATION' ? actionLabels.changeRegime : actionLabels.apply,
      isApplicable:    true,
      sources:         tip.articleRef ? [{ articleNumber: tip.articleRef, title: '' }] : undefined,
    }))
  }

  // ── Conversational chat ──────────────────────────────────────────────────────
  async chat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContext?: string,
    ragContext?: string,
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): Promise<string> {
    try {
      const systemParts = [buildSystemPrompt(language)]
      if (userContext) systemParts.push(userContext)
      if (ragContext)  systemParts.push(`\nРЕЛЕВАНТНЫЕ СТАТЬИ НК РК:\n${ragContext}`)

      const geminiHistory = history.map((m) => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

      const chatSession = this.model.startChat({
        systemInstruction: systemParts.join('\n\n'),
        history: geminiHistory,
        generationConfig: {
          temperature:     0.7,
          maxOutputTokens: 1024,
        },
      })

      const result = await chatSession.sendMessage(message)
      return result.response.text().trim()
    } catch (err) {
      logger.error('Gemini chat error', { err })
      if ((err as { status?: number })?.status === 429) throw new RateLimitError()
      throw new InternalError('AI service temporarily unavailable')
    }
  }

  // ── Streaming chat ────────────────────────────────────────────────────────────
  async* chatStream(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContext?: string,
    ragContext?: string,
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): AsyncIterable<string> {
    try {
      const systemParts = [buildSystemPrompt(language)]
      if (userContext) systemParts.push(userContext)
      if (ragContext)  systemParts.push(`\nРЕЛЕВАНТНЫЕ СТАТЬИ НК РК:\n${ragContext}`)

      const geminiHistory = history.map((m) => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

      const chatSession = this.model.startChat({
        systemInstruction: systemParts.join('\n\n'),
        history: geminiHistory,
        generationConfig: {
          temperature:     0.7,
          maxOutputTokens: 1024,
        },
      })

      const streamResult = await chatSession.sendMessageStream(message)
      for await (const chunk of streamResult.stream) {
        const text = chunk.text()
        if (text) yield text
      }
    } catch (err) {
      logger.error('Gemini chatStream error', { err })
      if ((err as { status?: number })?.status === 429) throw new RateLimitError()
      throw new InternalError('AI service temporarily unavailable')
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────
  private async generate(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.2,
          maxOutputTokens: 1024,
        },
      })
      return result.response.text().trim()
    } catch (err) {
      logger.error('Gemini API error', { err })
      if ((err as { status?: number })?.status === 429) throw new RateLimitError()
      throw new InternalError('AI service temporarily unavailable')
    }
  }

  private parseJson<T>(raw: string, schema: z.ZodSchema<T>): T {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      logger.warn('Gemini returned non-JSON response', { raw })
      throw new InternalError('AI returned an unexpected response format')
    }

    const result = schema.safeParse(parsed)
    if (!result.success) {
      logger.warn('Gemini response failed schema validation', {
        errors: result.error.errors,
        raw,
      })
      throw new InternalError('AI response did not match expected schema')
    }

    return result.data
  }
}

// Singleton instance
export const geminiService = new GeminiService()
