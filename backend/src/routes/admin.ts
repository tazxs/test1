import { Router } from 'express'
import { requireAuth, requireAdmin } from '@middleware/auth'
import { asyncHandler } from '@utils/asyncHandler'
import { AdminService } from '@services/AdminService'
import { sendSuccess, sendPaginated } from '@utils/response'
import { ValidationError } from '@utils/errors'
import type { SubscriptionPlan } from 'nalogai-shared/types/user.types'

export const adminRouter = Router()

// All admin routes require authentication + ADMIN role
adminRouter.use(requireAuth, requireAdmin)

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const stats = await AdminService.getDashboardStats()
    sendSuccess(res, stats)
  }),
)

// ── GET /api/admin/users ──────────────────────────────────────────────────────
adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page, limit, search, plan } = req.query as Record<string, string | undefined>

    const result = await AdminService.listUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      planFilter: plan as SubscriptionPlan | undefined,
    })

    sendPaginated(res, result.items, result.meta)
  }),
)

// ── GET /api/admin/users/:id ──────────────────────────────────────────────────
adminRouter.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await AdminService.getUserDetail(req.params.id)
    sendSuccess(res, user)
  }),
)

// ── PATCH /api/admin/users/:id/subscription ───────────────────────────────────
adminRouter.patch(
  '/users/:id/subscription',
  asyncHandler(async (req, res) => {
    const { plan } = req.body as { plan?: string }
    const validPlans: SubscriptionPlan[] = ['FREE', 'PRO', 'PRO_AI']

    if (!plan || !validPlans.includes(plan as SubscriptionPlan)) {
      throw new ValidationError(`Invalid plan. Must be one of: ${validPlans.join(', ')}`)
    }

    const updated = await AdminService.overrideSubscription(
      req.params.id,
      plan as SubscriptionPlan,
      req.user!.sub,
      req.ip,
    )

    sendSuccess(res, updated)
  }),
)

// ── POST /api/admin/users/:id/unmask-iin ─────────────────────────────────────
adminRouter.post(
  '/users/:id/unmask-iin',
  asyncHandler(async (req, res) => {
    const result = await AdminService.unmaskIIN(
      req.params.id,
      req.user!.sub,
      req.ip,
    )
    sendSuccess(res, result)
  }),
)

// ── GET /api/admin/users/:id/finances ────────────────────────────────────────
adminRouter.get(
  '/users/:id/finances',
  asyncHandler(async (req, res) => {
    const finances = await AdminService.getUserFinances(req.params.id)
    sendSuccess(res, finances)
  }),
)

// ── GET /api/admin/logs/:userId ───────────────────────────────────────────────
adminRouter.get(
  '/logs/:userId',
  asyncHandler(async (req, res) => {
    const { limit, actionCategory } = req.query as Record<string, string | undefined>
    const logs = await AdminService.getUserLogs(
      req.params.userId,
      limit ? parseInt(limit, 10) : undefined,
      actionCategory,
    )
    sendSuccess(res, logs)
  }),
)
