/**
 * CloudPayments Gateway Bridge
 *
 * Integrates with CloudPayments API (https://cloudpayments.kz) for processing
 * card payments in KZT. CloudPayments is PCI-DSS Level 1 compliant —
 * raw card data never touches our servers.
 *
 * Flow:
 *   1. Frontend collects card data via CloudPayments widget (PCI-compliant iframe)
 *   2. Widget returns a `token` to the frontend
 *   3. Frontend sends `token` to our /api/payments/subscribe
 *   4. We call CloudPayments /payments/charge with the token
 *   5. CloudPayments sends async webhook to /api/payments/webhook on success/failure
 *
 * Environment variables:
 *   CLOUDPAYMENTS_PUBLIC_ID  — Merchant public ID
 *   CLOUDPAYMENTS_API_SECRET — API secret for server-side calls
 *   CLOUDPAYMENTS_WEBHOOK_SECRET — HMAC secret for webhook signature verification
 */

import crypto from 'crypto'
import { logger } from '@utils/logger'
import { createExternalCircuit } from '@utils/circuitBreaker'

// ── Configuration ────────────────────────────────────────────────────────────
const CP_PUBLIC_ID = process.env.CLOUDPAYMENTS_PUBLIC_ID ?? ''
const CP_API_SECRET = process.env.CLOUDPAYMENTS_API_SECRET ?? ''
const CP_WEBHOOK_SECRET = process.env.CLOUDPAYMENTS_WEBHOOK_SECRET ?? ''
const CP_API_URL = 'https://api.cloudpayments.kz'

// ── Types ────────────────────────────────────────────────────────────────────
export interface ChargeRequest {
  amount: number
  currency: string
  description: string
  token: string
  accountId: string
  ipAddress?: string
}

export interface ChargeResponse {
  success: boolean
  transactionId: string
  reasonCode?: number
  reason?: string
  cardFirstSix?: string
  cardLastFour?: string
  cardType?: string
}

export interface WebhookPayload {
  TransactionId: number
  Amount: number
  Currency: string
  DateTime: string
  CardFirstSix: string
  CardLastFour: string
  CardType: string
  Status: string
  OperationType: string
  InvoiceId: string
  AccountId: string
  Name: string
  Email: string
  IpAddress: string
  IpCountry: string
  IpCity: string
  Issuer: string
  Description: string
  TestMode: boolean
  Token: string
  TotalFee: number
}

// ── Gateway class ────────────────────────────────────────────────────────────
export class CloudPaymentsGateway {
  private readonly publicId: string
  private readonly apiSecret: string

  constructor() {
    this.publicId = CP_PUBLIC_ID
    this.apiSecret = CP_API_SECRET
  }

  /**
   * Check if CloudPayments is configured.
   * When not configured, the system falls back to mock mode.
   */
  isConfigured(): boolean {
    return this.publicId.length > 0 && this.apiSecret.length > 0
  }

  /**
   * Charge a card using a CloudPayments token.
   * Wrapped in circuit breaker to prevent system hangs on gateway outages.
   */
  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    if (!this.isConfigured()) {
      // Mock mode — simulate successful payment
      logger.info('CloudPayments not configured — using mock mode', {
        amount: request.amount,
        currency: request.currency,
      })
      return {
        success: true,
        transactionId: `mock_cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        cardFirstSix: '000000',
        cardLastFour: '0000',
        cardType: 'Mock',
      }
    }

    const chargeWithBreaker = createExternalCircuit(
      'cloudpayments-charge',
      async (_req: ChargeRequest) => {
        const auth = Buffer.from(`${this.publicId}:${this.apiSecret}`).toString('base64')

        const response = await fetch(`${CP_API_URL}/payments/charge`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Amount: request.amount,
            Currency: request.currency,
            IpAddress: request.ipAddress ?? '127.0.0.1',
            Name: '', // PCI: we don't send cardholder name — it's in the token
            Token: request.token,
            AccountId: request.accountId,
            Description: request.description,
          }),
        })

        const data = (await response.json()) as {
          Success: boolean
          Model?: {
            TransactionId: number
            ReasonCode?: number
            Reason?: string
            CardFirstSix?: string
            CardLastFour?: string
            CardType?: string
          }
          Message?: string
        }

        if (!data.Success || !data.Model) {
          logger.warn('CloudPayments charge failed', {
            reason: data.Message,
            reasonCode: data.Model?.ReasonCode,
          })
          return {
            success: false,
            transactionId: '',
            reasonCode: data.Model?.ReasonCode,
            reason: data.Message ?? 'Payment declined',
          }
        }

        logger.info('CloudPayments charge successful', {
          transactionId: data.Model.TransactionId,
          cardLastFour: data.Model.CardLastFour,
        })

        return {
          success: true,
          transactionId: String(data.Model.TransactionId),
          cardFirstSix: data.Model.CardFirstSix,
          cardLastFour: data.Model.CardLastFour,
          cardType: data.Model.CardType,
        }
      },
      { timeoutMs: 30_000 },
    )
    return chargeWithBreaker(request)
  }
}

// ── Webhook signature verification ───────────────────────────────────────────
/**
 * Verify the HMAC-SHA256 signature of a CloudPayments webhook.
 * This prevents forged webhook requests from activating subscriptions.
 *
 * CloudPayments sends the signature in the `Content-HMAC` header,
 * computed as HMAC-SHA256(requestBody, apiSecret).
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!CP_WEBHOOK_SECRET) {
    logger.warn('CLOUDPAYMENTS_WEBHOOK_SECRET not set — skipping signature verification')
    return true // Allow in dev mode
  }

  const expected = crypto
    .createHmac('sha256', CP_WEBHOOK_SECRET)
    .update(body)
    .digest('base64')

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(expected, 'base64'),
  )
}

// ── Singleton ────────────────────────────────────────────────────────────────
export const cloudPayments = new CloudPaymentsGateway()
