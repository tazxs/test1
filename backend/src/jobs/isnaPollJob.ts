/**
 * ИСНА Status Polling Job
 *
 * After a declaration is submitted to the КГД ИСНА system, it enters PROCESSING
 * state. This cron job polls ИСНА every 30 minutes to check whether each
 * SUBMITTED declaration has been ACCEPTED or REJECTED, and updates the DB.
 *
 * Schedule: every 30 minutes (cron: "star/30 star star star star")
 *
 * Only runs if EGOV_ISNA_URL and EGOV_ISNA_TOKEN are configured.
 * Skips silently if ИСНА is not configured (LOCAL-SIGNED development mode).
 */

import cron from 'node-cron'
import { prisma } from '@utils/prisma'
import { logger } from '@utils/logger'
import { queryISNAStatus, EGovNotConfiguredError } from '@services/EGovService'

const JOB_NAME = 'isna-poll'

export function startIsnaPollJob(): void {
  // Skip if ИСНА is not configured
  if (!process.env.EGOV_ISNA_URL || !process.env.EGOV_ISNA_TOKEN) {
    logger.info(`${JOB_NAME}: ИСНА not configured — polling skipped`)
    return
  }

  cron.schedule('*/30 * * * *', () => {
    void pollSubmittedDeclarations()
  }, { name: JOB_NAME })

  logger.info(`${JOB_NAME}: polling job started (every 30 minutes)`)
}

async function pollSubmittedDeclarations(): Promise<void> {
  const declarations = await prisma.declaration.findMany({
    where: {
      status:               'SUBMITTED',
      eGovConfirmationCode: { not: null },
      deletedAt:            null,
      // Only poll declarations submitted less than 30 days ago
      submittedAt:          { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, eGovConfirmationCode: true, period: true },
  })

  if (declarations.length === 0) return

  logger.info(`${JOB_NAME}: checking ${declarations.length} submitted declaration(s)`)

  for (const decl of declarations) {
    const code = decl.eGovConfirmationCode
    if (!code || code.startsWith('EG-') || code.startsWith('LOCAL-SIGNED-')) {
      // Mock/local codes — skip ИСНА polling
      continue
    }

    try {
      const result = await queryISNAStatus(code)

      if (result.status === 'ACCEPTED') {
        await prisma.declaration.update({
          where: { id: decl.id },
          data:  { status: 'ACCEPTED' },
        })
        logger.info(`${JOB_NAME}: declaration ${decl.id} (${decl.period}) ACCEPTED by КГД`)
      } else if (result.status === 'REJECTED') {
        await prisma.declaration.update({
          where: { id: decl.id },
          data:  { status: 'REJECTED' },
        })
        logger.warn(`${JOB_NAME}: declaration ${decl.id} (${decl.period}) REJECTED by КГД — message: ${result.message ?? 'none'}`)
      }
      // PROCESSING — leave as SUBMITTED, will check next run
    } catch (err) {
      if (err instanceof EGovNotConfiguredError) return // shouldn't happen but guard
      logger.error(`${JOB_NAME}: failed to poll status for ${decl.id}: ${(err as Error).message}`)
    }
  }
}
