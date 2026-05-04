import { Router } from 'express'
import { z } from 'zod'
import { aiService } from '@services/AIService'
import { requireAuth } from '@middleware/auth'
import { validate } from '@middleware/validate'
import { aiLimiter } from '@middleware/rateLimit'
import { sendSuccess } from '@utils/response'
import { UpgradeRequiredError } from '@utils/errors'
import { prisma } from '@utils/prisma'
import { asyncHandler } from '@utils/asyncHandler'
import { logger } from '@utils/logger'
import { detectLanguage, normalizeLanguage, type SupportedLanguage } from '@utils/language'
import { ragService } from '@services/RagService'
import { TaxCalculatorService } from '@services/TaxCalculatorService'
import { BT_LABELS, BT_LABELS_BY_LANGUAGE, REGIME_LABELS, REGIME_LABELS_BY_LANGUAGE } from '@services/AiProviderService'
import {
  MRP_2025,
  ESP_RATES,
  PATENT,
} from 'nalogai-shared/constants/taxRates'
import type { TaxRegime } from 'nalogai-shared/types/user.types'
import type { TransactionType } from '@prisma/client'
import type { RegimeSaving } from '../../prompts/advicePrompt'

export const aiRouter = Router()

// All AI routes require auth + rate limiting
aiRouter.use(requireAuth)
aiRouter.use(aiLimiter)

/** Strip control characters and limit length before AI injection */
function sanitizeForPrompt(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, 200)
}

function requestLanguage(value: unknown, fallbackText?: string): SupportedLanguage {
  const headerLanguage = normalizeLanguage(value)
  if (fallbackText?.trim()) return detectLanguage(fallbackText, headerLanguage ?? 'ru')
  return headerLanguage ?? 'ru'
}

// ── User financial context builder ────────────────────────────────────────────
interface UserContextData {
  full:    string
  compact: string
}

function aiContextIntro(ctx: UserContextData, language: SupportedLanguage): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (language === 'kk') {
    return [
      {
        role:    'user',
        content: `Міне, NalogAI жүйесінен алынған қаржылық деректерім:\n\n${ctx.full}`,
      },
      {
        role:    'assistant',
        content: 'Мен жүйедегі деректерді: транзакцияларды, кірістерді, шығыстарды, санаттарды және салық режимін қарап шықтым. Әр жауапта осы нақты деректерге сүйенемін; қосымша құжат жіберудің қажеті жоқ.',
      },
    ]
  }

  if (language === 'en') {
    return [
      {
        role:    'user',
        content: `Here is my financial data from NalogAI:\n\n${ctx.full}`,
      },
      {
        role:    'assistant',
        content: 'I have reviewed the system data: transactions, income, expenses, categories, and tax regime. I will use these actual figures in every answer, so you do not need to send extra documents.',
      },
    ]
  }

  return [
    {
      role:    'user',
      content: `Вот мои финансовые данные из системы NalogAI:\n\n${ctx.full}`,
    },
    {
      role:    'assistant',
      content: 'Я получил и изучил все ваши данные из системы: транзакции, доходы, расходы, категории и налоговый режим. Буду опираться на эти реальные цифры в каждом ответе. Спрашивайте — не нужно ничего присылать дополнительно.',
    },
  ]
}

function enrichedQuestion(ctx: UserContextData, message: string, language: SupportedLanguage): string {
  const label = language === 'kk'
    ? 'Пайдаланушы сұрағы'
    : language === 'en'
      ? 'User question'
      : 'Вопрос пользователя'

  return `${ctx.compact}\n\n${label}: ${message}`
}

async function buildUserContext(userId: string): Promise<UserContextData> {
  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { fullName: true, businessType: true, taxRegime: true },
    }),
    prisma.transaction.findMany({
      where:   { userId, deletedAt: null },
      select:  { amount: true, type: true, category: true, description: true, date: true },
      orderBy: { date: 'desc' },
    }),
  ])

  const incomeTotal  = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount.toNumber(), 0)
  const expenseTotal = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount.toNumber(), 0)
  const netIncome    = incomeTotal - expenseTotal

  const categoryTotals: Record<string, number> = {}
  for (const t of transactions) {
    const key = `${t.type === 'INCOME' ? 'Доход' : 'Расход'} / ${t.category}`
    categoryTotals[key] = (categoryTotals[key] ?? 0) + t.amount.toNumber()
  }

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, amt]) => `  • ${key}: ${amt.toLocaleString('ru')} ₸`)
    .join('\n')

  const recentTxs = transactions.slice(0, 15)
    .map((t) =>
      `  • ${t.date.toISOString().slice(0, 10)}: ${t.type === 'INCOME' ? '+' : '-'}${Number(t.amount).toLocaleString('ru')} ₸  [${t.category}]  ${sanitizeForPrompt(t.description)}`,
    )
    .join('\n')

  const businessLabel = BT_LABELS[user?.businessType ?? ''] ?? user?.businessType ?? 'не указано'
  const regimeLabel   = REGIME_LABELS[user?.taxRegime ?? ''] ?? user?.taxRegime ?? 'не указано'

  const full = [
    '=== ДАННЫЕ ПОЛЬЗОВАТЕЛЯ (уже загружены из базы — НЕ проси их повторно) ===',
    '',
    `Имя:              ${user?.fullName ?? 'не указано'}`,
    `Форма бизнеса:    ${businessLabel}`,
    `Налоговый режим:  ${regimeLabel}`,
    '',
    `ФИНАНСОВАЯ СВОДКА (${transactions.length} транзакций):`,
    `  Итого доходов:  ${incomeTotal.toLocaleString('ru')} ₸`,
    `  Итого расходов: ${expenseTotal.toLocaleString('ru')} ₸`,
    `  Чистый доход:   ${netIncome.toLocaleString('ru')} ₸`,
    '',
    'РАЗБИВКА ПО КАТЕГОРИЯМ:',
    topCategories || '  нет данных',
    '',
    'ПОСЛЕДНИЕ 15 ТРАНЗАКЦИЙ:',
    recentTxs || '  нет данных',
    '=== КОНЕЦ ДАННЫХ ===',
  ].join('\n')

  const compact =
    `[Данные из системы: ${businessLabel}, ${regimeLabel}, ` +
    `${transactions.length} транзакций, ` +
    `доход ${incomeTotal.toLocaleString('ru')} ₸, ` +
    `расходы ${expenseTotal.toLocaleString('ru')} ₸, ` +
    `чистый доход ${netIncome.toLocaleString('ru')} ₸. ` +
    `Топ категории: ${Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v.toLocaleString('ru')}₸`).join(', ')}. ` +
    `Все данные у тебя есть — НЕ проси пользователя предоставить данные.]`

  return { full, compact }
}

// ── Compute regime savings via TaxCalculatorService ───────────────────────────
// Returns only regimes cheaper than the current one.
function computeRegimeSavings(
  grossIncome: number,
  currentRegime: TaxRegime,
  language: SupportedLanguage,
): RegimeSaving[] {
  const MONTHS = 12
  let currentBurden: number
  try {
    currentBurden = TaxCalculatorService.calculate({ grossIncome, regime: currentRegime, months: MONTHS }).totalTaxBurden
  } catch {
    return []
  }

  const ALL_REGIMES: TaxRegime[] = ['SIMPLIFIED_DECLARATION', 'PATENT', 'ESP', 'GENERAL_REGIME']
  const savings: RegimeSaving[] = []

  for (const regime of ALL_REGIMES) {
    if (regime === currentRegime) continue

    // Eligibility guard: skip regimes whose income cap is exceeded
    if (regime === 'ESP'    && grossIncome > ESP_RATES.maxAnnualRevenueMRP * MRP_2025) continue
    if (regime === 'PATENT' && grossIncome > PATENT.maxAnnualRevenueMRP   * MRP_2025) continue

    try {
      const alt = TaxCalculatorService.calculate({ grossIncome, regime, months: MONTHS })
      const saving = currentBurden - alt.totalTaxBurden
      if (saving > 0) {
        savings.push({ regime, label: REGIME_LABELS_BY_LANGUAGE[language][regime] ?? regime, saving: Math.round(saving) })
      }
    } catch {
      // Skip regimes that fail to calculate (e.g. unsupported input)
    }
  }

  return savings.sort((a, b) => b.saving - a.saving)
}

// ── POST /api/ai/categorize ───────────────────────────────────────────────────
const CategorizeSingleSchema = z.object({
  description: z.string().min(1).max(500),
  amount:      z.number().positive(),
  type:        z.enum(['INCOME', 'EXPENSE']),
})

aiRouter.post(
  '/categorize',
  validate(CategorizeSingleSchema),
  asyncHandler(async (req, res) => {
    const { description, amount, type } = req.body as z.infer<typeof CategorizeSingleSchema>
    const language = requestLanguage(req.headers['accept-language'], description)
    const result = await aiService.categorize(description, amount, type as TransactionType, language)
    sendSuccess(res, result)
  }),
)

// ── POST /api/ai/categorize-bulk ─────────────────────────────────────────────
const CategorizeBulkSchema = z.object({
  transactions: z.array(z.object({
    id:          z.string(),
    description: z.string().min(1).max(500),
    amount:      z.number().positive(),
    type:        z.enum(['INCOME', 'EXPENSE']),
  })).min(1).max(50),
})

aiRouter.post(
  '/categorize-bulk',
  validate(CategorizeBulkSchema),
  asyncHandler(async (req, res) => {
    const { transactions } = req.body as z.infer<typeof CategorizeBulkSchema>
    const language = requestLanguage(
      req.headers['accept-language'],
      transactions.map((t) => t.description).join('\n'),
    )
    const results = await aiService.categorizeBulk(
      transactions.map((t) => ({ ...t, type: t.type as TransactionType })),
      language,
    )
    sendSuccess(res, { results })
  }),
)

// ── GET /api/ai/advice ────────────────────────────────────────────────────────
// Requires PRO or PRO_AI plan.
// Uses TaxCalculatorService for real tax figures — never hallucinated.
// Injects RAG context from pgvector knowledge base.
aiRouter.get(
  '/advice',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub
    const language = requestLanguage(req.headers['accept-language'])

    // Plan gate — PRO or PRO_AI required for AI advice
    const dbUser = await prisma.user.findUnique({
      where:  { id: userId },
      select: { plan: true, businessType: true, taxRegime: true },
    })
    if (dbUser?.plan !== 'PRO' && dbUser?.plan !== 'PRO_AI') {
      throw new UpgradeRequiredError('AI-советы доступны только на тарифах PRO и PRO+AI')
    }

    const transactions = await prisma.transaction.findMany({
      where:  { userId, deletedAt: null },
      select: { amount: true, type: true },
    })

    const grossIncome  = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount.toNumber(), 0)
    const totalExpenses = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount.toNumber(), 0)
    const regime        = (dbUser.taxRegime ?? 'SIMPLIFIED_DECLARATION') as TaxRegime

    // Compute exact tax burden for current regime using TaxCalculatorService
    let currentTaxBurden = 0
    try {
      const calc = TaxCalculatorService.calculate({ grossIncome, regime, months: 12 })
      currentTaxBurden = calc.totalTaxBurden
    } catch (err) {
      logger.warn('TaxCalculatorService failed for /advice', { err, regime })
    }

    // Pre-compute savings for alternative regimes (eliminates hallucinated numbers)
    const regimeSavings = computeRegimeSavings(grossIncome, regime, language)

    // Fetch relevant NK RK articles from pgvector knowledge base
    const ragQuery = [
      'налоговая оптимизация',
      'салықты оңтайландыру',
      REGIME_LABELS_BY_LANGUAGE[language][regime] ?? REGIME_LABELS[regime] ?? regime,
      BT_LABELS_BY_LANGUAGE[language][dbUser.businessType ?? ''] ?? BT_LABELS[dbUser.businessType ?? ''] ?? '',
    ].join(' ')
    const ragArticles = await ragService.searchRelevantArticles(ragQuery, 5)
    const ragContext  = ragService.formatForPrompt(ragArticles, 1500, language)

    logger.info('AI advice requested', {
      userId, regime, grossIncome, currentTaxBurden,
      regimeSavingsCount: regimeSavings.length,
      ragArticlesFound:   ragArticles.length,
      language,
    })

    const tips = await aiService.getAdvice({
      grossIncome,
      totalExpenses,
      regime,
      businessType:     dbUser.businessType ?? 'SOLE_PROPRIETOR',
      currentTaxBurden,
      regimeSavings,
      ragContext,
      language,
    })

    sendSuccess(res, { tips })
  }),
)

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
// PRO_AI plan only. Injects financial context + RAG-retrieved NK RK articles.
const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(10).default([]),
})

aiRouter.post(
  '/chat',
  validate(ChatSchema),
  asyncHandler(async (req, res) => {
    // Plan gate — PRO_AI only (read from DB, never trust JWT for subscription state)
    const dbUser = await prisma.user.findUnique({
      where:  { id: req.user!.sub },
      select: { plan: true },
    })
    if (dbUser?.plan !== 'PRO_AI') {
      throw new UpgradeRequiredError('AI-чат доступен только на тарифе PRO+AI')
    }

    const { message, history } = req.body as z.infer<typeof ChatSchema>
    const language = requestLanguage(req.headers['accept-language'], message)

    // Build financial snapshot + RAG context in parallel
    const [ctx, ragArticles] = await Promise.all([
      buildUserContext(req.user!.sub),
      ragService.searchRelevantArticles(message, 4),
    ])
    const ragContext = ragService.formatForPrompt(ragArticles, 1500, language)

    logger.info('AI chat request', {
      userId:          req.user!.sub,
      fullContextLen:  ctx.full.length,
      ragArticlesFound: ragArticles.length,
      language,
    })

    // Three-layer context injection:
    // 1) systemInstruction — role + rules + user financial data
    // 2) synthetic history — full financial snapshot at conversation start
    // 3) compact summary prepended to user message — data stays near the question
    const contextHistory = aiContextIntro(ctx, language)
    const enrichedMessage = enrichedQuestion(ctx, message, language)

    const reply = await aiService.chat(
      enrichedMessage,
      [...contextHistory, ...history],
      ctx.full,
      ragContext,
      language,
    )

    sendSuccess(res, {
      message: {
        id:        `ai_${Date.now()}`,
        role:      'assistant' as const,
        content:   reply,
        createdAt: new Date().toISOString(),
      },
      suggestedQuestions: [],
      tokensUsed:         0,
    })
  }),
)

// ── POST /api/ai/chat/stream ──────────────────────────────────────────────────
// PRO_AI plan only. Server-Sent Events — streams tokens as they arrive from the
// AI provider. Takes full advantage of Groq's low time-to-first-token.
aiRouter.post(
  '/chat/stream',
  validate(ChatSchema),
  asyncHandler(async (req, res) => {
    const dbUser = await prisma.user.findUnique({
      where:  { id: req.user!.sub },
      select: { plan: true },
    })
    if (dbUser?.plan !== 'PRO_AI') {
      throw new UpgradeRequiredError('AI-чат доступен только на тарифе PRO+AI')
    }

    const { message, history } = req.body as z.infer<typeof ChatSchema>
    const language = requestLanguage(req.headers['accept-language'], message)

    // Fetch context in parallel — topK=3 and 1200-char chunks keep the prompt
    // tight for Groq's smaller context window while preserving source citations.
    const [ctx, ragArticles] = await Promise.all([
      buildUserContext(req.user!.sub),
      ragService.searchRelevantArticles(message, 3),
    ])
    const ragContext = ragService.formatForPrompt(ragArticles, 1200, language)

    const contextHistory = aiContextIntro(ctx, language)
    const enrichedMessage = enrichedQuestion(ctx, message, language)

    logger.info('AI chat/stream request', {
      userId:           req.user!.sub,
      ragArticlesFound: ragArticles.length,
      language,
    })

    // SSE headers — disable all buffering layers
    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()

    try {
      for await (const token of aiService.chatStream(
        enrichedMessage,
        [...contextHistory, ...history],
        ctx.full,
        ragContext,
        language,
      )) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`)
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    } catch (err) {
      logger.error('AI stream error', { err })
      res.write(`data: ${JSON.stringify({ error: 'AI service temporarily unavailable' })}\n\n`)
    } finally {
      res.end()
    }
  }),
)
