import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, signAccessToken } from '@middleware/auth'
import { validate } from '@middleware/validate'
import { sendSuccess } from '@utils/response'
import { ValidationError, NotFoundError } from '@utils/errors'
import { asyncHandler } from '@utils/asyncHandler'
import { PaymentService } from '@services/PaymentService'
import { verifyWebhookSignature } from '@services/CloudPaymentsGateway'
import { logWebhookReceived, logWebhookSignatureInvalid } from '@utils/paymentLogger'
import { logger } from '@utils/logger'
import { prisma } from '@utils/prisma'
import type { SubscriptionPlan } from '@prisma/client'

export const paymentsRouter = Router()

// ── POST /api/payments/subscribe (authenticated) ─────────────────────────────
paymentsRouter.use('/subscribe', requireAuth)

const SubscribeSchema = z.object({
  plan: z.enum(['FREE', 'PRO', 'PRO_AI']),
  // paymentToken: CloudPayments token or "kaspi_qr" — never log or store full card data
  paymentToken: z.string().min(1).max(256),
})

paymentsRouter.post(
  '/subscribe',
  validate(SubscribeSchema),
  asyncHandler(async (req, res) => {
    const { plan, paymentToken } = req.body as z.infer<typeof SubscribeSchema>
    const userId = req.user!.sub

    // Prevent re-purchasing the same plan
    if (plan === 'FREE') {
      throw new ValidationError('Cannot purchase the free plan')
    }

    const result = await PaymentService.subscribe(userId, plan as SubscriptionPlan, paymentToken)

    // Issue a fresh access token so the new plan is immediately reflected in JWT claims.
    // Without this, the old token still has the old plan and AI chat gate returns 403.
    const newAccessToken = signAccessToken({
      sub:   req.user!.sub,
      email: req.user!.email,
      plan:  result.plan,
      role:  req.user!.role,
      tokenVersion: req.user!.tokenVersion,
    })

    sendSuccess(res, { ...result, accessToken: newAccessToken })
  }),
)

// ── POST /api/payments/webhook (unauthenticated — CloudPayments callback) ────
// This endpoint is called by CloudPayments, not by our frontend.
// Security: verified via HMAC signature, not JWT.
// Idempotency: TransactionId is used as requestId to prevent double-processing.

// In-memory idempotency cache (cleared on restart — acceptable for webhook dedup)
const processedWebhooks = new Set<string>()
const WEBHOOK_CACHE_MAX = 10_000

function markWebhookProcessed(transactionId: string): void {
  processedWebhooks.add(transactionId)
  // Evict oldest entries if cache grows too large
  if (processedWebhooks.size > WEBHOOK_CACHE_MAX) {
    const first = processedWebhooks.values().next().value
    if (first) processedWebhooks.delete(first)
  }
}

const WebhookSchema = z.object({
  TransactionId: z.number(),
  Amount: z.number(),
  Currency: z.string(),
  Status: z.string(),
  AccountId: z.string(),
  CardLastFour: z.string().optional(),
  CardFirstSix: z.string().optional(),
  CardType: z.string().optional(),
  Description: z.string().optional(),
  Email: z.string().optional(),
  Name: z.string().optional(),
  DateTime: z.string().optional(),
  InvoiceId: z.string().optional(),
  OperationType: z.string().optional(),
  TestMode: z.boolean().optional(),
  Token: z.string().optional(),
  TotalFee: z.number().optional(),
  IpAddress: z.string().optional(),
  IpCountry: z.string().optional(),
  IpCity: z.string().optional(),
  Issuer: z.string().optional(),
})

paymentsRouter.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    // ── Signature verification ──────────────────────────────────────────────
    const signature = req.headers['content-hmac'] as string | undefined
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      logWebhookSignatureInvalid({ ip: req.ip })
      logger.warn('Webhook signature verification failed', { ip: req.ip })
      res.status(401).json({ success: false, error: 'Invalid signature' })
      return
    }

    // ── Parse and validate ──────────────────────────────────────────────────
    const parsed = WebhookSchema.safeParse(req.body)
    if (!parsed.success) {
      logger.warn('Webhook: invalid payload', { errors: parsed.error.issues })
      res.status(400).json({ success: false, error: 'Invalid payload' })
      return
    }

    const payload = parsed.data
    const requestId = String(payload.TransactionId)

    // ── Idempotency check ──────────────────────────────────────────────────
    if (processedWebhooks.has(requestId)) {
      logger.info('Webhook: duplicate blocked', { transactionId: requestId })
      res.status(200).json({ code: 0 })
      return
    }

    logWebhookReceived({
      transactionId: requestId,
      status: payload.Status,
      amount: payload.Amount,
      currency: payload.Currency,
      accountId: payload.AccountId,
    })

    // ── Process webhook ─────────────────────────────────────────────────────
    const result = await PaymentService.handleWebhook({
      transactionId: requestId,
      status: payload.Status,
      amount: payload.Amount,
      currency: payload.Currency,
      accountId: payload.AccountId,
    })

    // Mark as processed to prevent double-processing
    markWebhookProcessed(requestId)

    // CloudPayments expects HTTP 200 with { code: 0 } on success
    if (result.processed) {
      res.status(200).json({ code: 0 })
    } else {
      logger.warn('Webhook: not processed', { reason: result.reason, transactionId: requestId })
      res.status(200).json({ code: 0 }) // Still return 200 to avoid retries for unknown payloads
    }
  }),
)

// ── POST /api/payments/cancel (authenticated) ─────────────────────────────────
// Sets autoRenew = false but keeps access until current period ends.
paymentsRouter.use('/cancel', requireAuth)

paymentsRouter.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('User')

    if (user.plan === 'FREE') {
      throw new ValidationError('You are already on the free plan')
    }

    // Set autoRenew to false — access continues until accessUntil
    await prisma.user.update({
      where: { id: userId },
      data: { autoRenew: false },
    })

    logger.info('Subscription canceled (auto-renew disabled)', { userId, plan: user.plan })

    sendSuccess(res, {
      message: 'Auto-renew disabled. Your access continues until the end of the current billing period.',
      plan: user.plan,
      accessUntil: user.accessUntil,
      autoRenew: false,
    })
  }),
)
