import Groq from 'groq-sdk'
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from 'groq-sdk/resources/chat/completions'
import { z } from 'zod'
import type { TransactionCategory, TransactionType } from 'nalogai-shared/types/transaction.types'
import type { AIAdviceTip, AIAdviceType } from 'nalogai-shared/types/ai.types'
import { logger } from '@utils/logger'
import { AppError, InternalError, RateLimitError } from '@utils/errors'
import { createExternalCircuit } from '@utils/circuitBreaker'
import { buildSystemPrompt, LOCALIZED_ACTION_LABELS, LOCALIZED_LEGAL_DISCLAIMER } from '../../prompts/systemPrompt'
import { buildAdvicePrompt, type RegimeSaving } from '../../prompts/advicePrompt'
import { buildCategorizationPrompt, buildBulkCategorizationPrompt } from '../../prompts/categorizationPrompt'
import type { IAiProvider } from './AiProviderService'
import { BT_LABELS_BY_LANGUAGE, REGIME_LABELS_BY_LANGUAGE } from './AiProviderService'
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@utils/language'

// ── Zod schemas ────────────────────────────────────────────────────────────────

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
  articleRef:  z.string().min(1).max(80).optional(),
})

const AdviceArraySchema = z.array(AdviceTipRawSchema).min(1).max(5)

// ── Service ────────────────────────────────────────────────────────────────────
export class GroqService implements IAiProvider {
  private client: Groq
  private model: string
  private chatCompletion: (params: ChatCompletionCreateParams) => Promise<unknown>

  constructor() {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured')

    this.model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
    this.client = new Groq({ apiKey })
    this.chatCompletion = createExternalCircuit(
      'groq.chat.completions',
      async (params: ChatCompletionCreateParams): Promise<unknown> => {
        try {
          return await this.client.chat.completions.create(params)
        } catch (err) {
          if ((err as { status?: number })?.status === 429) throw new RateLimitError()
          throw err
        }
      },
      {
        timeoutMs: Number(process.env.GROQ_BREAKER_TIMEOUT_MS ?? 20_000),
        resetTimeoutMs: Number(process.env.GROQ_BREAKER_RESET_MS ?? 30_000),
        errorThresholdPercentage: Number(process.env.GROQ_BREAKER_ERROR_THRESHOLD ?? 50),
        volumeThreshold: Number(process.env.GROQ_BREAKER_VOLUME_THRESHOLD ?? 3),
      },
    )
  }

  // ── Single transaction categorization ─────────────────────────────────────
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

  // ── Bulk categorization ────────────────────────────────────────────────────
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

  // ── Tax optimization advice ────────────────────────────────────────────────
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

    const raw = await this.generate(adviceBody, buildSystemPrompt(params.language))
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

  // ── Conversational chat ────────────────────────────────────────────────────
  async chat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContext?: string,
    ragContext?: string,
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): Promise<string> {
    try {
      const messages = this.buildMessages(message, history, userContext, ragContext, language)
      const completion = await this.chatCompletion({
        model:       this.model,
        messages,
        temperature: 0.7,
        max_tokens:  1024,
      }) as ChatCompletion

      return completion.choices[0]?.message?.content?.trim() ?? ''
    } catch (err) {
      logger.error('Groq chat error', { err })
      if (err instanceof AppError) throw err
      throw new InternalError('AI service temporarily unavailable')
    }
  }

  // ── Streaming chat ────────────────────────────────────────────────────────
  async* chatStream(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContext?: string,
    ragContext?: string,
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): AsyncIterable<string> {
    try {
      const messages = this.buildMessages(message, history, userContext, ragContext, language)
      const stream = await this.chatCompletion({
        model:       this.model,
        messages,
        temperature: 0.7,
        max_tokens:  1024,
        stream:      true,
      }) as AsyncIterable<ChatCompletionChunk>

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content
        if (token) yield token
      }
    } catch (err) {
      logger.error('Groq chatStream error', { err })
      if (err instanceof AppError) throw err
      throw new InternalError('AI service temporarily unavailable')
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  private buildMessages(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContext?: string,
    ragContext?: string,
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): Groq.Chat.ChatCompletionMessageParam[] {
    const systemParts = [buildSystemPrompt(language)]
    if (userContext) systemParts.push(userContext)
    if (ragContext)  systemParts.push(`\nРЕЛЕВАНТНЫЕ СТАТЬИ НК РК:\n${ragContext}`)

    return [
      { role: 'system', content: systemParts.join('\n\n') },
      ...history.map((m) => ({
        role:    m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]
  }

  private async generate(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const messages: Groq.Chat.ChatCompletionMessageParam[] = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push({ role: 'user', content: prompt })

      const completion = await this.chatCompletion({
        model:       this.model,
        messages,
        temperature: 0.2,
        max_tokens:  1024,
      }) as ChatCompletion

      return completion.choices[0]?.message?.content?.trim() ?? ''
    } catch (err) {
      logger.error('Groq API error', { err })
      if (err instanceof AppError) throw err
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
      logger.warn('Groq returned non-JSON response', { raw })
      throw new InternalError('AI returned an unexpected response format')
    }

    const result = schema.safeParse(parsed)
    if (!result.success) {
      logger.warn('Groq response failed schema validation', {
        errors: result.error.errors,
        raw,
      })
      throw new InternalError('AI response did not match expected schema')
    }

    return result.data
  }
}

// Singleton instance
export const groqService = new GroqService()
