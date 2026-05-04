import 'dotenv/config'
import { app } from './app'
import { connectRedis } from '@utils/redis'
import { logger } from '@utils/logger'
import { startIsnaPollJob } from '@jobs/isnaPollJob'
import { startDeadlineRemindersJob } from '@jobs/deadlineReminders'
import { startNotificationWorkers } from '@jobs/notificationWorker'
import { startSoftDeleteCleanup } from '@jobs/softDeleteCleanup'
import { captureException, flushSentry } from '@utils/sentry'

const PORT = Number(process.env.PORT ?? 4000)

function validateProductionConfig(): void {
  const isProd = process.env.NODE_ENV === 'production'
  if (!isProd) return

  const errors: string[] = []

  // JWT secrets must be strong
  const accessSecret = process.env.JWT_ACCESS_SECRET ?? ''
  const refreshSecret = process.env.JWT_REFRESH_SECRET ?? ''
  if (accessSecret.length < 32 || accessSecret.includes('dev_')) {
    errors.push('JWT_ACCESS_SECRET is too weak for production (min 32 chars, no "dev_" prefix)')
  }
  if (refreshSecret.length < 32 || refreshSecret.includes('dev_')) {
    errors.push('JWT_REFRESH_SECRET is too weak for production (min 32 chars, no "dev_" prefix)')
  }

  // CORS origin must be set and HTTPS
  const corsOrigin = process.env.CORS_ORIGIN ?? ''
  if (!corsOrigin) {
    errors.push('CORS_ORIGIN must be set in production')
  } else if (!corsOrigin.startsWith('https://')) {
    errors.push('CORS_ORIGIN must use HTTPS in production')
  }

  // Encryption key for bank credentials
  const encKey = process.env.ENCRYPTION_KEY ?? ''
  if (encKey.length < 32) {
    errors.push('ENCRYPTION_KEY must be set and at least 32 characters for bank credential encryption')
  }

  // Database password must not match project name
  const dbPass = process.env.POSTGRES_PASSWORD ?? ''
  if (dbPass === 'nalogai' || dbPass.length < 12) {
    errors.push('POSTGRES_PASSWORD is too weak for production')
  }

  if (errors.length > 0) {
    for (const e of errors) logger.error(`STARTUP CHECK FAILED: ${e}`)
    process.exit(1)
  }

  logger.info('Production startup checks passed')
}

async function start(): Promise<void> {
  try {
    validateProductionConfig()
    await connectRedis()
    startNotificationWorkers()
    startIsnaPollJob()
    startDeadlineRemindersJob()
    startSoftDeleteCleanup()
    app.listen(PORT, () => {
      logger.info(`NalogAI backend listening on port ${PORT}`)
    })
  } catch (err) {
    logger.error('Failed to start server', { err })
    captureException(err, {
      level: 'fatal',
      tags: { source: 'startup' },
    })
    await flushSentry()
    process.exit(1)
  }
}
void start()
