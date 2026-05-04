/**
 * Payment Flow Simulation Tests
 *
 * Mocks successful, declined, and expired card transactions
 * to ensure UI and backend remain in sync.
 *
 * Tests the full flow:
 *   Frontend → POST /api/payments/subscribe → PaymentService → CloudPayments (mock)
 *   → Plan activation → Fresh JWT issuance
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock CloudPayments Gateway ───────────────────────────────────────────────
const mockCharge = vi.fn()

vi.mock('../CloudPaymentsGateway', () => ({
  cloudPayments: {
    isConfigured: () => false, // Mock mode
    charge: (...args: unknown[]) => mockCharge(...args),
  },
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
}))

// ── Mock Prisma ──────────────────────────────────────────────────────────────
const mockUserUpdate = vi.fn().mockResolvedValue({})
const mockUserFindUnique = vi.fn()

vi.mock('@utils/prisma', () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

// ── Mock logger ──────────────────────────────────────────────────────────────
vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@utils/paymentLogger', () => ({
  logPaymentInitiated: vi.fn(),
  logPaymentSuccess: vi.fn(),
  logPaymentFailed: vi.fn(),
  logWebhookReceived: vi.fn(),
  logWebhookSignatureInvalid: vi.fn(),
  logSubscriptionActivated: vi.fn(),
  logSubscriptionRenewalFailed: vi.fn(),
}))

vi.mock('@utils/circuitBreaker', () => ({
  createExternalCircuit: vi.fn((_name: string, fn: unknown) => fn),
  getCircuitBreakerSnapshots: vi.fn().mockReturnValue([]),
}))

import { PaymentService } from '../PaymentService'

describe('Payment Flow Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Successful payment ─────────────────────────────────────────────────────
  describe('Successful payment', () => {
    it('processes PRO subscription successfully', async () => {
      mockCharge.mockResolvedValueOnce({
        success: true,
        transactionId: 'txn_success_123',
        cardLastFour: '4242',
        cardType: 'Visa',
      })

      const result = await PaymentService.subscribe('user-1', 'PRO', 'card_token_abc')

      expect(result.success).toBe(true)
      expect(result.transactionId).toBe('txn_success_123')
      expect(result.plan).toBe('PRO')
      expect(result.amount).toBe(4990)
      expect(result.cardLastFour).toBe('4242')

      // Verify DB was updated
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { plan: 'PRO' },
      })
    })

    it('processes PRO_AI subscription successfully', async () => {
      mockCharge.mockResolvedValueOnce({
        success: true,
        transactionId: 'txn_success_456',
        cardLastFour: '1234',
        cardType: 'MasterCard',
      })

      const result = await PaymentService.subscribe('user-2', 'PRO_AI', 'kaspi_qr')

      expect(result.success).toBe(true)
      expect(result.plan).toBe('PRO_AI')
      expect(result.amount).toBe(9990)
    })

    it('FREE plan does not call gateway', async () => {
      const result = await PaymentService.subscribe('user-3', 'FREE', 'any')

      expect(result.success).toBe(true)
      expect(result.amount).toBe(0)
      expect(result.transactionId).toMatch(/^free_/)
      expect(mockCharge).not.toHaveBeenCalled()
    })
  })

  // ── Declined payment ───────────────────────────────────────────────────────
  describe('Declined payment', () => {
    it('throws error on declined card', async () => {
      mockCharge.mockResolvedValueOnce({
        success: false,
        transactionId: '',
        reason: 'Insufficient funds',
        reasonCode: 5041,
      })

      await expect(
        PaymentService.subscribe('user-4', 'PRO', 'card_declined'),
      ).rejects.toThrow('Insufficient funds')

      // Verify DB was NOT updated
      expect(mockUserUpdate).not.toHaveBeenCalled()
    })

    it('throws error on stolen card', async () => {
      mockCharge.mockResolvedValueOnce({
        success: false,
        transactionId: '',
        reason: 'Card stolen',
        reasonCode: 5012,
      })

      await expect(
        PaymentService.subscribe('user-5', 'PRO_AI', 'card_stolen'),
      ).rejects.toThrow('Card stolen')
    })
  })

  // ── Expired card ───────────────────────────────────────────────────────────
  describe('Expired card', () => {
    it('throws error on expired card', async () => {
      mockCharge.mockResolvedValueOnce({
        success: false,
        transactionId: '',
        reason: 'Expired card',
        reasonCode: 5021,
      })

      await expect(
        PaymentService.subscribe('user-6', 'PRO', 'card_expired'),
      ).rejects.toThrow('Expired card')

      expect(mockUserUpdate).not.toHaveBeenCalled()
    })
  })

  // ── Gateway timeout ────────────────────────────────────────────────────────
  describe('Gateway timeout', () => {
    it('propagates timeout error', async () => {
      mockCharge.mockRejectedValueOnce(new Error('Gateway timeout'))

      await expect(
        PaymentService.subscribe('user-7', 'PRO', 'card_timeout'),
      ).rejects.toThrow('Gateway timeout')

      expect(mockUserUpdate).not.toHaveBeenCalled()
    })
  })

  // ── Webhook handling ───────────────────────────────────────────────────────
  describe('Webhook handling', () => {
    it('activates plan on completed webhook', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-8', plan: 'FREE' })

      const result = await PaymentService.handleWebhook({
        transactionId: 'txn_webhook_1',
        status: 'Completed',
        amount: 4990,
        currency: 'KZT',
        accountId: 'user-8',
      })

      expect(result.processed).toBe(true)
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-8' },
        data: { plan: 'PRO' },
      })
    })

    it('does not downgrade via webhook', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-9', plan: 'PRO_AI' })

      const result = await PaymentService.handleWebhook({
        transactionId: 'txn_webhook_2',
        status: 'Completed',
        amount: 4990, // PRO amount, but user already has PRO_AI
        currency: 'KZT',
        accountId: 'user-9',
      })

      expect(result.processed).toBe(true)
      // Should NOT have been called because PRO < PRO_AI
      expect(mockUserUpdate).not.toHaveBeenCalled()
    })

    it('handles declined webhook', async () => {
      const result = await PaymentService.handleWebhook({
        transactionId: 'txn_webhook_3',
        status: 'Declined',
        amount: 9990,
        currency: 'KZT',
        accountId: 'user-10',
      })

      expect(result.processed).toBe(true)
      expect(result.reason).toBe('Payment declined')
    })

    it('returns not processed for unknown user', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null)

      const result = await PaymentService.handleWebhook({
        transactionId: 'txn_webhook_4',
        status: 'Completed',
        amount: 4990,
        currency: 'KZT',
        accountId: 'nonexistent',
      })

      expect(result.processed).toBe(false)
      expect(result.reason).toBe('User not found')
    })

    it('returns not processed for unknown amount', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-11', plan: 'FREE' })

      const result = await PaymentService.handleWebhook({
        transactionId: 'txn_webhook_5',
        status: 'Completed',
        amount: 999, // No plan matches this amount
        currency: 'KZT',
        accountId: 'user-11',
      })

      expect(result.processed).toBe(false)
      expect(result.reason).toBe('Unknown amount')
    })
  })
})
