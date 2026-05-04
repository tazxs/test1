import { prisma } from '@utils/prisma'
import { logger } from '@utils/logger'
import { cloudPayments, type ChargeRequest } from './CloudPaymentsGateway'
import {
  logPaymentInitiated,
  logPaymentSuccess,
  logPaymentFailed,
} from '@utils/paymentLogger'
import type { SubscriptionPlan } from '@prisma/client'

// ── Plan pricing (KZT) ────────────────────────────────────────────────────────
const PLAN_PRICE: Record<SubscriptionPlan, number> = {
  FREE:   0,
  PRO:    4990,
  PRO_AI: 9990,
}

// ── Payment result ────────────────────────────────────────────────────────────
export interface PaymentResult {
  success: boolean
  transactionId: string
  plan: SubscriptionPlan
  amount: number
  cardLastFour?: string
}

// ── PaymentService ────────────────────────────────────────────────────────────
export class PaymentService {
  /**
   * Process a plan subscription payment.
   *
   * `paymentToken` is a client-side token from CloudPayments widget or Kaspi QR.
   * Raw card data is NEVER sent to our server — PCI-DSS compliant.
   *
   * Flow:
   *   1. Validate plan and pricing
   *   2. Call CloudPayments gateway (or mock if not configured)
   *   3. On success: update user plan in DB
   *   4. Log payment event (PCI-compliant — no card data)
   *   5. Return result with fresh transaction ID
   */
  static async subscribe(
    userId: string,
    plan: SubscriptionPlan,
    paymentToken: string,
  ): Promise<PaymentResult> {
    const amount = PLAN_PRICE[plan]

    if (plan === 'FREE') {
      // Downgrade — no payment needed, just update plan
      await prisma.user.update({ where: { id: userId }, data: { plan: 'FREE' } })
      return { success: true, transactionId: `free_${Date.now()}`, plan, amount: 0 }
    }

    // Log payment initiation (PCI-compliant: no card data)
    logPaymentInitiated({
      userId,
      plan,
      amount,
      currency: 'KZT',
      transactionId: '',
      provider: cloudPayments.isConfigured() ? 'cloudpayments' : 'mock',
    })

    // ── Gateway call ──────────────────────────────────────────────────────────
    const chargeRequest: ChargeRequest = {
      amount,
      currency: 'KZT',
      description: `NalogAI ${plan} подписка`,
      token: paymentToken,
      accountId: userId,
    }

    const result = await cloudPayments.charge(chargeRequest)

    if (!result.success) {
      logPaymentFailed({
        userId,
        plan,
        amount,
        currency: 'KZT',
        transactionId: result.transactionId,
        provider: cloudPayments.isConfigured() ? 'cloudpayments' : 'mock',
        reason: result.reason,
      })
      throw new Error(result.reason ?? 'Payment declined')
    }

    // ── Update user plan ──────────────────────────────────────────────────────
    // If user already has an active plan, extend accessUntil by 30 days
    // Otherwise, set accessUntil to 30 days from now
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, accessUntil: true },
    })

    const now = new Date()
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
    let accessUntil: Date

    if (existingUser?.accessUntil && existingUser.accessUntil > now) {
      // Extend from current accessUntil (pro-rata extension)
      accessUntil = new Date(existingUser.accessUntil.getTime() + THIRTY_DAYS_MS)
    } else {
      // New subscription: 30 days from now
      accessUntil = new Date(now.getTime() + THIRTY_DAYS_MS)
    }

    await prisma.user.update({
      where: { id: userId },
      data: { plan, tokenVersion: { increment: 1 }, accessUntil, autoRenew: true },
    })

    logPaymentSuccess({
      userId,
      plan,
      amount,
      currency: 'KZT',
      transactionId: result.transactionId,
      provider: cloudPayments.isConfigured() ? 'cloudpayments' : 'mock',
      cardLastFour: result.cardLastFour,
    })

    logger.info('Payment processed', { userId, plan, amount, transactionId: result.transactionId })

    return {
      success: true,
      transactionId: result.transactionId,
      plan,
      amount,
      cardLastFour: result.cardLastFour,
    }
  }

  /**
   * Handle a CloudPayments webhook notification.
   * Called when CloudPayments confirms a payment asynchronously.
   *
   * This is the authoritative source of truth for payment status.
   * The /subscribe endpoint is optimistic — the webhook confirms it.
   */
  static async handleWebhook(payload: {
    transactionId: string
    status: string
    amount: number
    currency: string
    accountId: string
  }): Promise<{ processed: boolean; reason?: string }> {
    const { transactionId, status, amount, accountId } = payload

    if (status === 'Completed') {
      // Payment confirmed — ensure user plan is activated
      const user = await prisma.user.findUnique({ where: { id: accountId } })
      if (!user) {
        logger.warn('Webhook: user not found', { accountId, transactionId })
        return { processed: false, reason: 'User not found' }
      }

      // Determine plan from amount
      const plan = this.amountToPlan(amount)
      if (!plan) {
        logger.warn('Webhook: unknown amount', { amount, transactionId })
        return { processed: false, reason: 'Unknown amount' }
      }

      // Idempotent: only upgrade, never downgrade via webhook
      if (this.planRank(plan) > this.planRank(user.plan)) {
        await prisma.user.update({
          where: { id: accountId },
          data: { plan, tokenVersion: { increment: 1 } },
        })
        logger.info('Webhook: plan activated', { userId: accountId, plan, transactionId })
      }

      return { processed: true }
    }

    if (status === 'Declined' || status === 'Cancelled') {
      logPaymentFailed({
        userId: accountId,
        plan: 'FREE',
        amount,
        currency: 'KZT',
        transactionId,
        provider: 'cloudpayments',
        reason: `Webhook status: ${status}`,
      })
      return { processed: true, reason: `Payment ${status.toLowerCase()}` }
    }

    return { processed: false, reason: `Unhandled status: ${status}` }
  }

  /** Map amount to plan */
  private static amountToPlan(amount: number): SubscriptionPlan | null {
    if (amount >= 9990) return 'PRO_AI'
    if (amount >= 4990) return 'PRO'
    return null
  }

  /** Plan hierarchy rank for comparison */
  private static planRank(plan: SubscriptionPlan): number {
    switch (plan) {
      case 'FREE': return 0
      case 'PRO': return 1
      case 'PRO_AI': return 2
      default: return 0
    }
  }
}
