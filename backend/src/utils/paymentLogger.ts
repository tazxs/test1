/**
 * Payment Event Logger
 *
 * Separate, structured logger for payment events.
 * PCI-DSS compliant: NEVER logs raw card data, CVV, or full card numbers.
 * Only logs: transaction IDs, amounts, plan names, user IDs, timestamps, status.
 *
 * Logs are written to a dedicated file for billing audit trail.
 */

import winston from 'winston'
import path from 'path'

const LOG_DIR = process.env.PAYMENT_LOG_DIR ?? path.join(process.cwd(), 'logs')

const paymentLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json(),
)

export const paymentLogger = winston.createLogger({
  level: 'info',
  format: paymentLogFormat,
  defaultMeta: { service: 'payment' },
  transports: [
    // Dedicated payment log file
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'payments.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 52, // ~1 year of weekly rotation
    }),
    // Also log to console in non-production
    ...(process.env.NODE_ENV !== 'production'
      ? [new winston.transports.Console({ format: paymentLogFormat })]
      : []),
  ],
})

// ── PCI-DSS compliant event types ────────────────────────────────────────────

export interface PaymentEventBase {
  userId: string
  plan: string
  amount: number
  currency: string
  transactionId: string
  provider: 'cloudpayments' | 'mock'
}

export function logPaymentInitiated(event: PaymentEventBase): void {
  paymentLogger.info('Payment initiated', {
    ...event,
    // NEVER log: card number, CVV, cardholder name, token
  })
}

export function logPaymentSuccess(event: PaymentEventBase & { cardLastFour?: string }): void {
  paymentLogger.info('Payment successful', {
    ...event,
    // Only last 4 digits — PCI compliant
    cardLastFour: event.cardLastFour ?? '****',
  })
}

export function logPaymentFailed(event: PaymentEventBase & { reason?: string }): void {
  paymentLogger.warn('Payment failed', {
    ...event,
    reason: event.reason ?? 'Unknown',
  })
}

export function logWebhookReceived(event: {
  transactionId: string
  status: string
  amount: number
  currency: string
  accountId: string
}): void {
  paymentLogger.info('Webhook received', event)
}

export function logWebhookSignatureInvalid(event: { ip?: string }): void {
  paymentLogger.error('Webhook signature verification failed', event)
}

export function logSubscriptionActivated(event: {
  userId: string
  plan: string
  transactionId: string
}): void {
  paymentLogger.info('Subscription activated', event)
}

export function logSubscriptionRenewalFailed(event: {
  userId: string
  plan: string
  reason?: string
}): void {
  paymentLogger.warn('Subscription renewal failed', event)
}
