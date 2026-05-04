import { prisma } from '@utils/prisma'
import { NotFoundError } from '@utils/errors'
import { logger } from '@utils/logger'
import type { SubscriptionPlan } from 'nalogai-shared/types/user.types'
import type { ActionCategory } from '@services/AuditLogService'
import type { Prisma } from '@prisma/client'

// ── IIN Masking ────────────────────────────────────────────────────────────────
export function maskIIN(iin: string | null): string | null {
  if (!iin || iin.length < 6) return iin
  return iin.slice(0, 3) + '***' + iin.slice(-2)
}

// ── Audit Logging ──────────────────────────────────────────────────────────────
export async function createAuditLog(params: {
  actorId: string
  targetId?: string
  action: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  actionCategory?: ActionCategory
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        targetId: params.targetId ?? null,
        action: params.action,
        details: (params.details as Prisma.InputJsonValue) ?? undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        actionCategory: params.actionCategory ?? 'SYSTEM',
      },
    })
  } catch (err) {
    logger.error('Failed to create audit log', { action: params.action, error: err })
  }
}

// ── Admin Service ──────────────────────────────────────────────────────────────
export const AdminService = {
  /**
   * List users with pagination and optional search by IIN or email.
   * IINs are masked in the response for security.
   */
  async listUsers(params: {
    page?: number
    limit?: number
    search?: string
    planFilter?: SubscriptionPlan
  }) {
    const page = Math.max(1, params.page ?? 1)
    const limit = Math.min(100, Math.max(1, params.limit ?? 25))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (params.search) {
      where.OR = [
        { iin: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { fullName: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    if (params.planFilter) {
      where.plan = params.planFilter
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          iin: true,
          plan: true,
          role: true,
          businessType: true,
          taxRegime: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              declarations: true,
              transactions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return {
      items: users.map((u) => ({
        ...u,
        iin: maskIIN(u.iin),
        declarationCount: u._count?.declarations ?? 0,
        transactionCount: u._count?.transactions ?? 0,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    }
  },

  /**
   * Get a single user's full details (for support view).
   * IIN is masked by default.
   */
  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        declarations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            period: true,
            periodType: true,
            formType: true,
            status: true,
            createdAt: true,
            submittedAt: true,
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amount: true,
            type: true,
            category: true,
            description: true,
            date: true,
          },
        },
        bankConnections: {
          select: {
            id: true,
            provider: true,
            status: true,
            lastSyncAt: true,
            syncStatus: true,
          },
        },
        _count: {
          select: {
            declarations: true,
            transactions: true,
          },
        },
      },
    })

    if (!user) throw new NotFoundError('User')

    return {
      ...user,
      iin: maskIIN(user.iin),
      password: undefined, // Never expose password hash
      declarationCount: user._count?.declarations ?? 0,
      transactionCount: user._count?.transactions ?? 0,
    }
  },

  /**
   * Unmask a user's IIN (logged action for audit trail).
   */
  async unmaskIIN(userId: string, actorId: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, iin: true },
    })
    if (!user) throw new NotFoundError('User')

    await createAuditLog({
      actorId,
      targetId: userId,
      action: 'UNMASK_IIN',
      details: { reason: 'Admin support view' },
      ipAddress,
      actionCategory: 'SECURITY',
    })

    return { iin: user.iin }
  },

  /**
   * Manually override a user's subscription plan.
   */
  async overrideSubscription(
    userId: string,
    plan: SubscriptionPlan,
    actorId: string,
    ipAddress?: string,
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('User')

    const oldPlan = user.plan

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { plan, tokenVersion: { increment: 1 } },
      select: { id: true, email: true, plan: true },
    })

    await createAuditLog({
      actorId,
      targetId: userId,
      action: 'SUBSCRIPTION_OVERRIDE',
      details: { oldPlan, newPlan: plan },
      ipAddress,
      actionCategory: 'SYSTEM',
    })

    logger.info('Admin subscription override', {
      adminId: actorId,
      targetUserId: userId,
      oldPlan,
      newPlan: plan,
    })

    return updated
  },

  /**
   * Get recent audit/activity logs for a specific user (support view).
   * Returns logs with network identity fields (ipAddress, userAgent, actionCategory)
   * for non-repudiation verification.
   */
  async getUserLogs(userId: string, limit = 50, actionCategory?: string) {
    const where: Record<string, unknown> = {
      OR: [{ targetId: userId }, { actorId: userId }],
    }

    if (actionCategory) {
      where.actionCategory = actionCategory
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        actor: { select: { id: true, email: true, fullName: true } },
      },
    })

    return logs
  },

  /**
   * Get financial overview for a user (admin deep eye).
   * Returns income/expense records, progress to Form 910 threshold, and tax obligations.
   */
  async getUserFinances(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('User')

    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    // Get all transactions for current year
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startOfYear },
        deletedAt: null,
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        amount: true,
        type: true,
        category: true,
        description: true,
        date: true,
        source: true,
      },
    })

    // Calculate totals
    const totalIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Form 910 threshold: 24,038 MRP = 103,964,350 KZT (MRP = 4,325)
    const FORM_910_THRESHOLD = 24_038 * 4_325 // 103,964,350 KZT
    const progressPercent = Math.min(100, (totalIncome / FORM_910_THRESHOLD) * 100)

    // Real-time tax calculation (simplified declaration: 3% on income)
    const simplifiedTax = Math.round(totalIncome * 0.03)
    const ipn = Math.round(simplifiedTax / 2)
    const socialTax = simplifiedTax - ipn

    // OPV: 10% of income, capped at 50 MZP × 12
    const MZP = 85_000
    const opvBase = Math.min(totalIncome, MZP * 50 * 12)
    const pensionContribution = Math.round(opvBase * 0.10)

    // OSMS: 5% × 1.4 MZP × 12
    const medicalInsurance = Math.round(MZP * 1.4 * 0.05 * 12)

    return {
      transactions,
      summary: {
        totalIncome,
        totalExpense,
        netIncome: totalIncome - totalExpense,
      },
      form910Progress: {
        threshold: FORM_910_THRESHOLD,
        currentIncome: totalIncome,
        remaining: Math.max(0, FORM_910_THRESHOLD - totalIncome),
        percent: Math.round(progressPercent * 100) / 100,
        exceedsThreshold: totalIncome > FORM_910_THRESHOLD,
      },
      taxObligations: {
        ipn,
        socialTax,
        pensionContribution,
        medicalInsurance,
        totalTaxBurden: ipn + socialTax + pensionContribution + medicalInsurance,
      },
    }
  },

  /**
   * Dashboard stats: total users, MRR estimate, Form 910 count.
   */
  async getDashboardStats() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [totalUsers, proUsers, proAiUsers, form910Count, newUsersThisMonth] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { plan: 'PRO' } }),
        prisma.user.count({ where: { plan: 'PRO_AI' } }),
        prisma.declaration.count({ where: { formType: 'FORM_910' } }),
        prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      ])

    // MRR estimate: PRO = 4990₸, PRO_AI = 9990₸
    const PRO_PRICE = 4990
    const PRO_AI_PRICE = 9990
    const mrr = proUsers * PRO_PRICE + proAiUsers * PRO_AI_PRICE

    return {
      totalUsers,
      proUsers,
      proAiUsers,
      freeUsers: totalUsers - proUsers - proAiUsers,
      mrr,
      form910Count,
      newUsersThisMonth,
    }
  },
}
