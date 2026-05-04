import { PrismaClient } from '@prisma/client'
import { logger } from './logger'
import { captureException } from './sentry'

// Singleton pattern — reuse connection across hot-reloads in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      ...(process.env.NODE_ENV === 'development'
        ? [{ emit: 'event' as const, level: 'query' as const }]
        : []),
      { emit: 'event' as const, level: 'warn' as const },
      { emit: 'event' as const, level: 'error' as const },
    ],
  })

prisma.$on('error' as never, (e: { message: string; target?: string }) => {
  const err = new Error(e.message)
  err.name = 'PrismaQueryError'
  const target = e.target ?? 'unknown'
  logger.error('Prisma query error', {
    err,
    target,
  })
  captureException(err, {
    tags: { component: 'prisma', target },
  })
})

prisma.$on('warn' as never, (e: { message: string; target?: string }) => {
  logger.warn('Prisma warning', {
    message: e.message,
    target: e.target ?? 'unknown',
  })
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma

  // Log slow queries in dev (query text omitted to avoid PII leakage)
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    if (e.duration > 200) {
      logger.warn(`Slow query detected (${e.duration}ms)`)
    }
  })
}
