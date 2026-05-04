/**
 * SubscriptionService — plan-based feature gating.
 *
 * All methods are pure functions: no I/O, no req/res, stateless.
 * Monetary values are not involved here; limits are integer counts only.
 * PII rule: no user IDs, emails, or IINs are logged in this module.
 */

export type PlanTier = 'FREE' | 'PRO' | 'PRO_AI'

interface PlanLimits {
  /** Maximum AI requests per calendar month. 0 = none allowed. */
  aiRequestsPerMonth: number
  /** Maximum tax declarations per calendar year. -1 = unlimited. */
  declarationsPerYear: number
  /** Maximum concurrent active bank connections. */
  bankConnections: number
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: {
    aiRequestsPerMonth: 0,
    declarationsPerYear: 2,
    bankConnections: 1,
  },
  PRO: {
    aiRequestsPerMonth: 50,
    declarationsPerYear: 12,
    bankConnections: 3,
  },
  PRO_AI: {
    aiRequestsPerMonth: 500,
    declarationsPerYear: -1,
    bankConnections: 10,
  },
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

export const SubscriptionService = {
  /**
   * Returns true if the given plan allows at least one AI request per month.
   */
  canUseAI(plan: PlanTier): boolean {
    return PLAN_LIMITS[plan].aiRequestsPerMonth > 0
  },

  /**
   * Returns true if the user has not yet reached the bank connection limit
   * for their plan.
   *
   * @param plan - The user's current subscription tier.
   * @param currentCount - Number of active BankConnection records for the user.
   */
  canAddBankConnection(plan: PlanTier, currentCount: number): boolean {
    return currentCount < PLAN_LIMITS[plan].bankConnections
  },

  /**
   * Returns true if the trial period has not yet expired.
   * A null value means no trial was ever started → trial is not active.
   */
  isTrialActive(trialEndsAt: Date | null): boolean {
    if (trialEndsAt === null) return false
    return trialEndsAt.getTime() > Date.now()
  },

  /**
   * Returns the number of whole days remaining in the trial period.
   * Returns 0 if the trial has expired or was never started.
   */
  getRemainingTrial(trialEndsAt: Date | null): number {
    if (trialEndsAt === null) return 0
    const remaining = trialEndsAt.getTime() - Date.now()
    if (remaining <= 0) return 0
    return Math.floor(remaining / MS_PER_DAY)
  },
}
