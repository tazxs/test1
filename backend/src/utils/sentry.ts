import type { Express } from 'express'
import type { CaptureContext, NodeOptions } from '@sentry/node'
import { createRequire } from 'module'
import { logger } from './logger'

interface SentryClient {
  init(options: NodeOptions): void
  captureException(error: unknown, context?: CaptureContext): string
  flush(timeout?: number): Promise<boolean>
  setupExpressErrorHandler(app: Express): void
}

const requireModule = createRequire(__filename)
let sentry: SentryClient | null = null
let initialized = false

function loadSentry(): SentryClient | null {
  if (sentry) return sentry
  try {
    sentry = requireModule('@sentry/node') as SentryClient
    return sentry
  } catch (err) {
    logger.warn('Sentry DSN configured but @sentry/node is unavailable', { err })
    return null
  }
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN
  if (!dsn || initialized) return

  const client = loadSentry()
  if (!client) return

  client.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  })

  process.on('uncaughtException', (err) => {
    captureException(err, {
      level: 'fatal',
      tags: { source: 'process', event: 'uncaughtException' },
    })
    logger.error('Uncaught exception', { err })
  })

  process.on('unhandledRejection', (reason) => {
    captureException(reason, {
      level: 'fatal',
      tags: { source: 'process', event: 'unhandledRejection' },
    })
    logger.error('Unhandled rejection', {
      err: reason instanceof Error ? reason : undefined,
      reason: reason instanceof Error ? undefined : String(reason),
    })
  })

  initialized = true
  logger.info('Sentry initialized')
}

export function setupSentryErrorHandler(app: Express): void {
  if (!initialized || !sentry) return
  sentry.setupExpressErrorHandler(app)
}

export function captureException(
  err: unknown,
  context?: CaptureContext,
): void {
  if (!initialized || !sentry) return
  sentry.captureException(err, context)
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized || !sentry) return
  await sentry.flush(timeoutMs)
}

export function isSentryEnabled(): boolean {
  return initialized
}
