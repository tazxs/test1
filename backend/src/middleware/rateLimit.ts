import type { RequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { RateLimitError } from '@utils/errors'
import { redis } from '@utils/redis'

const isTest = process.env.NODE_ENV === 'test'
const isProd = process.env.NODE_ENV === 'production'
const noopMiddleware: RequestHandler = (_req, _res, next) => next()

function makeLimiter(windowMs: number, max: number, prefix: string): RequestHandler {
  if (isTest) return noopMiddleware
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Suppress express-rate-limit's trust proxy validation warning.
    // We explicitly set `trust proxy: 1` in app.ts (single-hop proxy).
    validate: { trustProxy: false },
    // In production, use Redis so limits are shared across all container replicas.
    // sendCommand is a closure — redis.raw is accessed at request time (after connectRedis()),
    // not at module-load time. If Redis is unavailable, rate-limit-redis passes the request through.
    ...(isProd && {
      store: new RedisStore({
        sendCommand: (...args: string[]) => redis.raw.sendCommand(args),
        prefix: `rl:${prefix}:`,
      }),
    }),
    handler: (_req, _res, next) => next(new RateLimitError()),
  })
}

/** 100 requests / 15 min — general API */
export const apiLimiter = makeLimiter(15 * 60 * 1000, 100, 'api')

/** 5 requests / 1 min — auth endpoints (login + register) */
export const authLimiter = makeLimiter(60 * 1000, 5, 'auth')

/** 20 requests / 15 min — AI endpoints */
export const aiLimiter = makeLimiter(15 * 60 * 1000, 20, 'ai')
