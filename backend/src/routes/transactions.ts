import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '@middleware/auth'
import { validate } from '@middleware/validate'
import { sendSuccess } from '@utils/response'
import { NotFoundError } from '@utils/errors'
import { asyncHandler } from '@utils/asyncHandler'
import { prisma } from '@utils/prisma'
import { logAction, SYSTEM_AUDIT_METADATA, type ActionCategory } from '@services/AuditLogService'
import type { TransactionType, TransactionCategory, TransactionSource } from '@prisma/client'

export const transactionsRouter = Router()

transactionsRouter.use(requireAuth)

// ── Shared serialiser ─────────────────────────────────────────────────────────
function serialize(t: {
  id: string
  userId: string
  amount: unknown
  type: TransactionType
  category: TransactionCategory
  description: string
  source: TransactionSource
  externalId: string | null
  aiConfidence: unknown
  date: Date
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: t.id,
    userId: t.userId,
    amount: Number(t.amount),
    type: t.type,
    category: t.category,
    description: t.description,
    source: t.source,
    externalId: t.externalId,
    aiConfidence: t.aiConfidence !== null ? Number(t.aiConfidence) : null,
    date: t.date.toISOString().slice(0, 10),
    deletedAt: t.deletedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

// ── Category label mapping for Russian audit summaries ────────────────────────
const CATEGORY_LABELS_RU: Record<string, string> = {
  SERVICES_INCOME: 'Услуги',
  GOODS_INCOME: 'Товары',
  RENT_INCOME: 'Аренда',
  CONSULTING_INCOME: 'Консалтинг',
  FREELANCE_INCOME: 'Фриланс',
  DIVIDEND_INCOME: 'Дивиденды',
  INTEREST_INCOME: 'Проценты',
  ASSET_SALE_INCOME: 'Продажа активов',
  OTHER_INCOME: 'Прочий доход',
  OFFICE_EXPENSES: 'Офис',
  EQUIPMENT_EXPENSES: 'Оборудование',
  MARKETING_EXPENSES: 'Маркетинг',
  SALARY_EXPENSES: 'Зарплата',
  TRANSPORT_EXPENSES: 'Транспорт',
  UTILITIES_EXPENSES: 'Коммунальные',
  INSURANCE_EXPENSES: 'Страхование',
  TAX_EXPENSES: 'Налоги',
  BANK_EXPENSES: 'Банковские',
  REPAIR_EXPENSES: 'Ремонт',
  SUBSCRIPTION_EXPENSES: 'Подписки',
  OTHER_EXPENSES: 'Прочие расходы',
  UNCATEGORIZED: 'Без категории',
}

/**
 * Format amount in KZT with thousands separator for audit summary.
 * Example: 500000 → "500 000 ₸"
 */
function formatKZTAudit(amount: number): string {
  return amount.toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₸'
}

// ── Valid categories ─────────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  'SERVICES_INCOME', 'GOODS_INCOME', 'RENT_INCOME', 'CONSULTING_INCOME',
  'FREELANCE_INCOME', 'DIVIDEND_INCOME', 'INTEREST_INCOME', 'ASSET_SALE_INCOME', 'OTHER_INCOME',
  'OFFICE_EXPENSES', 'EQUIPMENT_EXPENSES', 'MARKETING_EXPENSES', 'SALARY_EXPENSES',
  'TRANSPORT_EXPENSES', 'UTILITIES_EXPENSES', 'INSURANCE_EXPENSES', 'TAX_EXPENSES',
  'BANK_EXPENSES', 'REPAIR_EXPENSES', 'SUBSCRIPTION_EXPENSES', 'OTHER_EXPENSES',
  'UNCATEGORIZED',
] as const

// ── GET /api/transactions ─────────────────────────────────────────────────────
const ListQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub
    const { page, limit } = ListQuerySchema.parse(req.query)

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, deletedAt: null },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({
        where: { userId, deletedAt: null },
      }),
    ])

    sendSuccess(res, {
      items: rows.map(serialize),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  }),
)

// ── POST /api/transactions ────────────────────────────────────────────────────
const CreateSchema = z.object({
  amount:      z.number().positive(),
  type:        z.enum(['INCOME', 'EXPENSE']),
  category:    z.enum(VALID_CATEGORIES),
  description: z.string().min(1).max(500),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source:      z.enum(['MANUAL', 'KASPI', 'HALYK', 'OTHER_BANK']).default('MANUAL'),
})

transactionsRouter.post(
  '/',
  validate(CreateSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub
    const body = req.body as z.infer<typeof CreateSchema>

    const tx = await prisma.transaction.create({
      data: {
        userId,
        amount:      body.amount,
        type:        body.type as TransactionType,
        category:    body.category as TransactionCategory,
        description: body.description,
        source:      body.source as TransactionSource,
        date:        new Date(body.date),
      },
    })

    // ── Non-Repudiation Audit Log ────────────────────────────────────────────
    // Log the exact financial payload with network identity for zero-trust verification.
    const isSystemAction = body.source !== 'MANUAL'
    const auditMeta = isSystemAction
      ? SYSTEM_AUDIT_METADATA
      : {
          ipAddress: req.auditMeta?.ipAddress ?? 'unknown',
          userAgent: req.auditMeta?.userAgent ?? 'unknown',
          actionCategory: 'FINANCIAL' as ActionCategory,
        }

    const typeLabel = body.type === 'INCOME' ? 'доход' : 'расход'
    const categoryLabel = CATEGORY_LABELS_RU[body.category] ?? body.category
    const summary = body.type === 'INCOME'
      ? `Пользователь добавил ${typeLabel}: ${formatKZTAudit(body.amount)}. Категория: ${categoryLabel}.`
      : `Пользователь добавил ${typeLabel}: ${formatKZTAudit(body.amount)}. Категория: ${categoryLabel}.`

    await logAction(
      userId,
      'TRANSACTION_CREATED',
      {
        summary,
        transactionId: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        category: tx.category,
        description: tx.description,
        source: tx.source,
        date: tx.date.toISOString().slice(0, 10),
        // Snapshot of the exact raw transaction object (minus PII)
        newData: {
          id: tx.id,
          amount: Number(tx.amount),
          type: tx.type,
          category: tx.category,
          description: tx.description,
          source: tx.source,
          date: tx.date.toISOString().slice(0, 10),
        },
      },
      auditMeta,
    )

    sendSuccess(res, serialize(tx), 201)
  }),
)

// ── PATCH /api/transactions/:id ───────────────────────────────────────────────
const UpdateSchema = z.object({
  category:    z.enum(VALID_CATEGORIES).optional(),
  description: z.string().min(1).max(500).optional(),
})

transactionsRouter.patch(
  '/:id',
  validate(UpdateSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub
    const id     = req.params['id'] as string
    const body   = req.body as z.infer<typeof UpdateSchema>

    const existing = await prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('Transaction')

    const tx = await prisma.transaction.update({
      where: { id },
      data: {
        ...(body.category    && { category:    body.category as TransactionCategory }),
        ...(body.description && { description: body.description }),
      },
    })

    // ── Non-Repudiation Audit Log ────────────────────────────────────────────
    const categoryLabel = CATEGORY_LABELS_RU[tx.category] ?? tx.category
    const summary = `Пользователь обновил транзакцию: ${formatKZTAudit(Number(tx.amount))}. Категория: ${categoryLabel}.`

    await logAction(
      userId,
      'TRANSACTION_UPDATED',
      {
        summary,
        transactionId: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        category: tx.category,
        description: tx.description,
        oldData: {
          category: existing.category,
          description: existing.description,
        },
        newData: {
          category: tx.category,
          description: tx.description,
        },
      },
      {
        ipAddress: req.auditMeta?.ipAddress ?? 'unknown',
        userAgent: req.auditMeta?.userAgent ?? 'unknown',
        actionCategory: 'FINANCIAL',
      },
    )

    sendSuccess(res, serialize(tx))
  }),
)

// ── DELETE /api/transactions/:id (soft delete) ────────────────────────────────
transactionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub
    const id     = req.params['id'] as string

    const existing = await prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('Transaction')

    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    // ── Non-Repudiation Audit Log ────────────────────────────────────────────
    const categoryLabel = CATEGORY_LABELS_RU[existing.category] ?? existing.category
    const summary = `Пользователь удалил транзакцию: ${formatKZTAudit(Number(existing.amount))}. Категория: ${categoryLabel}.`

    await logAction(
      userId,
      'TRANSACTION_DELETED',
      {
        summary,
        transactionId: existing.id,
        amount: Number(existing.amount),
        type: existing.type,
        category: existing.category,
        description: existing.description,
        deletedData: {
          id: existing.id,
          amount: Number(existing.amount),
          type: existing.type,
          category: existing.category,
          description: existing.description,
          source: existing.source,
          date: existing.date.toISOString().slice(0, 10),
        },
      },
      {
        ipAddress: req.auditMeta?.ipAddress ?? 'unknown',
        userAgent: req.auditMeta?.userAgent ?? 'unknown',
        actionCategory: 'FINANCIAL',
      },
    )

    sendSuccess(res, { ok: true })
  }),
)
