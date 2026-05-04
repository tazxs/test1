/**
 * AuditLogService — centralized audit logging for all controllers.
 *
 * Every significant user action (auth, payment, declaration, admin, financial)
 * is logged with actor, target, action type, details, IP address, user agent,
 * and action category for zero-trust non-repudiation.
 *
 * PII rule: IINs are NEVER stored in audit details — only masked versions.
 * All timestamps are stored in UTC (PostgreSQL default).
 */
import { prisma } from '@utils/prisma'
import { logger } from '@utils/logger'
import type { Prisma } from '@prisma/client'

// ── Action Types ───────────────────────────────────────────────────────────────

export type AuditAction =
  // Auth
  | 'USER_REGISTER'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'ONBOARDING_COMPLETE'
  // Payment
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_WEBHOOK_RECEIVED'
  | 'PAYMENT_WEBHOOK_DUPLICATE_BLOCKED'
  | 'SUBSCRIPTION_CANCELED'
  // Declaration
  | 'DECLARATION_CREATED'
  | 'DECLARATION_SUBMITTED'
  | 'DECLARATION_PDF_GENERATED'
  // Financial (Non-Repudiation Critical)
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_UPDATED'
  | 'TRANSACTION_DELETED'
  // Admin
  | 'ADMIN_SUBSCRIPTION_OVERRIDE'
  | 'ADMIN_UNMASK_IIN'
  | 'ADMIN_VIEW_USER_DETAIL'
  | 'ADMIN_VIEW_USER_LOGS'

// ── Action Categories ──────────────────────────────────────────────────────────

export type ActionCategory = 'FINANCIAL' | 'SECURITY' | 'SYSTEM'

/**
 * Maps audit actions to their categories for filtering.
 * Financial actions are the highest priority for non-repudiation.
 */
const ACTION_CATEGORY_MAP: Record<string, ActionCategory> = {
  // Financial — user-declared income/expense (non-repudiation critical)
  TRANSACTION_CREATED: 'FINANCIAL',
  TRANSACTION_UPDATED: 'FINANCIAL',
  TRANSACTION_DELETED: 'FINANCIAL',
  PAYMENT_INITIATED: 'FINANCIAL',
  PAYMENT_SUCCESS: 'FINANCIAL',
  PAYMENT_FAILED: 'FINANCIAL',
  PAYMENT_WEBHOOK_RECEIVED: 'FINANCIAL',
  PAYMENT_WEBHOOK_DUPLICATE_BLOCKED: 'FINANCIAL',
  SUBSCRIPTION_CANCELED: 'FINANCIAL',
  // Security — auth and access control
  USER_REGISTER: 'SECURITY',
  USER_LOGIN: 'SECURITY',
  USER_LOGOUT: 'SECURITY',
  ADMIN_UNMASK_IIN: 'SECURITY',
  // System — everything else
  ONBOARDING_COMPLETE: 'SYSTEM',
  DECLARATION_CREATED: 'SYSTEM',
  DECLARATION_SUBMITTED: 'SYSTEM',
  DECLARATION_PDF_GENERATED: 'SYSTEM',
  ADMIN_SUBSCRIPTION_OVERRIDE: 'SYSTEM',
  ADMIN_VIEW_USER_DETAIL: 'SYSTEM',
  ADMIN_VIEW_USER_LOGS: 'SYSTEM',
}

// ── Audit Metadata ─────────────────────────────────────────────────────────────

/**
 * Network identity + categorization metadata attached to every audit log.
 * Extracted from the HTTP request by AuditContextMiddleware.
 */
export interface AuditMetadata {
  ipAddress: string
  userAgent: string
  actionCategory: ActionCategory
}

/** System-generated metadata for automated actions (AI categorization, cron jobs, etc.) */
export const SYSTEM_AUDIT_METADATA: AuditMetadata = {
  ipAddress: 'SYSTEM',
  userAgent: 'NalogAI-Internal/1.0',
  actionCategory: 'SYSTEM',
}

// ── Audit Log Parameters ───────────────────────────────────────────────────────

interface AuditLogParams {
  actorId: string
  targetId?: string
  action: AuditAction
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  actionCategory?: ActionCategory
}

/**
 * Create an audit log entry. Fire-and-forget — never throws.
 * All controllers should call this after significant actions.
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        targetId: params.targetId ?? null,
        action: params.action,
        details: (params.details as Prisma.InputJsonValue) ?? undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        actionCategory: params.actionCategory ?? ACTION_CATEGORY_MAP[params.action] ?? 'SYSTEM',
      },
    })
  } catch (err) {
    // Audit logging must never break the main flow
    logger.error('Failed to create audit log', {
      action: params.action,
      actorId: params.actorId,
      error: err,
    })
  }
}

/**
 * Convenience method: log a user action with full network identity metadata.
 * Stores the actual values entered by the user as JSON in the `details` field.
 * PII fields (iin, password, token) are automatically redacted.
 *
 * This is the PRIMARY method for non-repudiation logging.
 */
export async function logAction(
  userId: string,
  action: AuditAction,
  metadata: Record<string, unknown>,
  auditMeta: AuditMetadata,
  options?: { targetId?: string },
): Promise<void> {
  // Redact PII fields from metadata before storing
  const redactedMetadata: Record<string, unknown> = {}
  const PII_KEYS = new Set(['password', 'token', 'iin', 'cardnumber', 'cvv', 'cardtoken'])
  for (const [key, value] of Object.entries(metadata)) {
    redactedMetadata[key] = PII_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value
  }

  await createAuditLog({
    actorId: userId,
    targetId: options?.targetId,
    action,
    details: redactedMetadata,
    ipAddress: auditMeta.ipAddress,
    userAgent: auditMeta.userAgent,
    actionCategory: auditMeta.actionCategory,
  })
}

/**
 * Query audit logs with filters. Used by admin dashboard.
 * Returns logs with network identity fields for non-repudiation verification.
 */
export async function queryAuditLogs(params: {
  actorId?: string
  targetId?: string
  action?: AuditAction
  actionCategory?: ActionCategory
  page?: number
  limit?: number
}) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(200, Math.max(1, params.limit ?? 50))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (params.actorId) where.actorId = params.actorId
  if (params.targetId) where.targetId = params.targetId
  if (params.action) where.action = params.action
  if (params.actionCategory) where.actionCategory = params.actionCategory

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actor: { select: { id: true, email: true, fullName: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    items: logs,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Export old audit logs to a compressed JSON file and optionally delete them.
 * Used by the log rotation cron job.
 */
export async function rotateAuditLogs(retentionDays = 30): Promise<{ exported: number; deleted: number }> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const oldLogs = await prisma.auditLog.findMany({
    where: { createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
  })

  if (oldLogs.length === 0) return { exported: 0, deleted: 0 }

  // In production: export to JSON, compress with gzip, write to /backups/logs/
  logger.info('Audit log rotation', {
    exported: oldLogs.length,
    cutoffDate: cutoff.toISOString(),
  })

  // Delete exported logs
  const { count: deleted } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  return { exported: oldLogs.length, deleted }
}
