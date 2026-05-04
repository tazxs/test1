/**
 * Soft-Delete Cleanup Cron Job
 *
 * Permanently purges soft-deleted records older than 5 years.
 * This complies with Kazakhstan tax record retention laws (НК РК):
 * taxpayers must retain records for 5 years after the tax period.
 *
 * Runs monthly on the 1st at 03:00 Asia/Almaty (low-traffic window).
 *
 * Tables affected:
 *   - transactions (deletedAt < 5 years ago)
 *   - declarations  (deletedAt < 5 years ago)
 *
 * ─── Safety ──────────────────────────────────────────────────────────────────
 * - Only deletes records where deletedAt IS NOT NULL AND deletedAt < cutoff
 * - Active records (deletedAt = NULL) are NEVER touched
 * - Logs every batch deletion with counts for audit trail
 * - Uses batched deletes (500 per batch) to avoid long-running transactions
 */

import cron from 'node-cron'
import { prisma } from '@utils/prisma'
import { logger } from '@utils/logger'

const JOB_NAME = 'soft-delete-cleanup'

/** Number of years to retain soft-deleted records (per RK Tax Code) */
const RETENTION_YEARS = 5

/** Batch size for DELETE operations */
const BATCH_SIZE = 500

/**
 * Calculate the cutoff date: records soft-deleted before this date
 * are eligible for permanent deletion.
 */
function getCutoffDate(): Date {
  const now = new Date()
  now.setFullYear(now.getFullYear() - RETENTION_YEARS)
  return now
}

/**
 * Permanently delete soft-deleted transactions in batches.
 * Returns the total number of deleted records.
 */
async function purgeTransactions(cutoff: Date): Promise<number> {
  let totalDeleted = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.$executeRaw`
      DELETE FROM transactions
      WHERE id IN (
        SELECT id FROM transactions
        WHERE "deletedAt" IS NOT NULL AND "deletedAt" < ${cutoff}
        LIMIT ${BATCH_SIZE}
      )
    `

    if (batch === 0) break
    totalDeleted += batch
    logger.info('Purged batch of soft-deleted transactions', { job: JOB_NAME, table: 'transactions', batch, totalDeleted })
  }

  return totalDeleted
}

/**
 * Permanently delete soft-deleted declarations in batches.
 * Returns the total number of deleted records.
 */
async function purgeDeclarations(cutoff: Date): Promise<number> {
  let totalDeleted = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.$executeRaw`
      DELETE FROM declarations
      WHERE id IN (
        SELECT id FROM declarations
        WHERE "deletedAt" IS NOT NULL AND "deletedAt" < ${cutoff}
        LIMIT ${BATCH_SIZE}
      )
    `

    if (batch === 0) break
    totalDeleted += batch
    logger.info('Purged batch of soft-deleted declarations', { job: JOB_NAME, table: 'declarations', batch, totalDeleted })
  }

  return totalDeleted
}

/**
 * Main cleanup job handler.
 */
async function runCleanup(): Promise<void> {
  const startTime = Date.now()
  const cutoff = getCutoffDate()

  logger.info(
    'Starting soft-delete cleanup job',
    { job: JOB_NAME, cutoff: cutoff.toISOString(), retentionYears: RETENTION_YEARS },
  )

  try {
    const [txCount, declCount] = await Promise.all([
      purgeTransactions(cutoff),
      purgeDeclarations(cutoff),
    ])

    const durationMs = Date.now() - startTime
    logger.info(
      'Soft-delete cleanup completed',
      {
        job: JOB_NAME,
        transactionsDeleted: txCount,
        declarationsDeleted: declCount,
        durationMs,
        cutoff: cutoff.toISOString(),
      },
    )
  } catch (err) {
    logger.error('Soft-delete cleanup failed', { job: JOB_NAME, err })
  }
}

/**
 * Start the cleanup cron job.
 * Schedule: 1st of every month at 03:00 Asia/Almaty (UTC+5).
 */
export function startSoftDeleteCleanup(): void {
  // Run on the 1st of every month at 03:00 Almaty time
  // node-cron timezone option handles the UTC+5 conversion
  cron.schedule('0 3 1 * *', () => {
    void runCleanup()
  }, {
    timezone: 'Asia/Almaty',
  })

  logger.info('Soft-delete cleanup job scheduled', { job: JOB_NAME, schedule: '0 3 1 * * Asia/Almaty' })
}

/**
 * Run cleanup immediately (for manual trigger or testing).
 */
export async function runCleanupNow(): Promise<void> {
  await runCleanup()
}
