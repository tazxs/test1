import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { errorHandler } from '@middleware/errorHandler'
import { apiLimiter } from '@middleware/rateLimit'
import { auditContextMiddleware } from '@middleware/auditContext'
import { authRouter } from '@routes/auth'
import { aiRouter } from '@routes/ai'
import { banksRouter } from '@routes/banks'
import { paymentsRouter } from '@routes/payments'
import { declarationsRouter } from '@routes/declarations'
import { transactionsRouter } from '@routes/transactions'
import { usersRouter } from '@routes/users'
import { notificationsRouter } from '@routes/notifications'
import { adminRouter } from '@routes/admin'
import { prisma } from '@utils/prisma'
import { redis } from '@utils/redis'
import { getCircuitBreakerSnapshots } from '@utils/circuitBreaker'
import { initSentry, isSentryEnabled, setupSentryErrorHandler } from '@utils/sentry'
import { getNotificationQueueHealth } from '@jobs/notificationQueue'

initSentry()

export const app = express()

// ── Trust Proxy ────────────────────────────────────────────────────────────────
// Required for correct IP extraction behind Nginx/Cloudflare reverse proxy.
// Express will parse X-Forwarded-For and set req.ip to the leftmost (original client) entry.
// SECURITY: `1` means trust only the first hop (our Nginx/Cloudflare proxy).
// This prevents clients from spoofing X-Forwarded-For by bypassing the load balancer.
// Direct connections will use socket.remoteAddress, which cannot be spoofed.
app.set('trust proxy', 1)

// ── Vercel Deployment URLs ─────────────────────────────────────────────────────
// Production: https://<project>.vercel.app
// Preview:    https://<project>-<hash>.vercel.app
// Both are matched via wildcard patterns for CSP and CORS.
const VERCEL_ORIGIN = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
const CORS_ORIGINS: string[] = [
  process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Vercel production domain (e.g. https://nalogai.vercel.app)
  ...(VERCEL_ORIGIN ? [VERCEL_ORIGIN] : []),
  // Vercel preview deployments (e.g. https://nalogai-abc123.vercel.app)
  'https://*.vercel.app',
]

// ── Strict Content Security Policy ─────────────────────────────────────────────
// Only allow scripts, styles, and connections from trusted sources.
// This prevents XSS, data injection, and unauthorized script execution.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Sentry error tracking
          'https://browser.sentry-cdn.com',
          // Google Fonts preconnect
          'https://fonts.googleapis.com',
          // Vercel deployment (inline scripts, analytics)
          'https://*.vercel.app',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for TailwindCSS dynamic styles
          'https://fonts.googleapis.com',
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
          'data:',
        ],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.sentry.io',
          'https://*.vercel.app',
        ],
        connectSrc: [
          "'self'",
          // Our API — production CORS origin
          process.env.CORS_ORIGIN ?? 'http://localhost:5173',
          process.env.API_URL ?? 'http://localhost:3000',
          // Vercel deployment origin
          ...(VERCEL_ORIGIN ? [VERCEL_ORIGIN] : []),
          'https://*.vercel.app',
          // Sentry
          'https://*.sentry.io',
          'https://*.ingest.sentry.io',
          // Google Fonts
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
          // Groq AI API
          'https://api.groq.com',
          // Google Gemini API
          'https://generativelanguage.googleapis.com',
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    // Keep other helmet defaults
    crossOriginEmbedderPolicy: false, // May interfere with font loading
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin font loading
  }),
)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, mobile apps, curl)
      if (!origin) return callback(null, true)

      // Check exact match against configured CORS_ORIGIN
      if (origin === (process.env.CORS_ORIGIN ?? 'http://localhost:5173')) {
        return callback(null, true)
      }

      // Check Vercel production domain
      if (VERCEL_ORIGIN && origin === VERCEL_ORIGIN) {
        return callback(null, true)
      }

      // Check Vercel preview deployments (*.vercel.app)
      try {
        const hostname = new URL(origin).hostname
        if (hostname.endsWith('.vercel.app')) {
          return callback(null, true)
        }
      } catch { /* invalid URL — reject */ }

      return callback(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
  }),
)
app.use(compression())
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(auditContextMiddleware) // Attach IP + User-Agent to every request for audit logging
app.use('/api', apiLimiter)

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/ai', aiRouter)
app.use('/api/banks', banksRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/declarations', declarationsRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/users', usersRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/admin', adminRouter)

app.get('/api/health', async (_req, res) => {
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch { /* db unreachable */ }

  const redisOk = redis.connected

  // Config-presence checks only — no live pings to external services on every health call
  const notificationsTelegram = Boolean(process.env.TELEGRAM_BOT_TOKEN)
  const notificationsEmail    = Boolean(process.env.SMTP_HOST)

  const dependenciesOk = dbOk && redisOk
  const notificationQueue = await getNotificationQueueHealth()
  const circuits = getCircuitBreakerSnapshots()
  const openCircuits = circuits.filter((circuit) => circuit.state === 'open')
  const allOk = dependenciesOk && openCircuits.length === 0

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    db: dbOk,
    redis: redisOk,
    observability: {
      sentry: isSentryEnabled(),
      logging: {
        format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
        userIdFilterable: true,
      },
      circuits,
    },
    notifications: {
      telegram: notificationsTelegram,
      email:    notificationsEmail,
      queue:    notificationQueue,
    },
    version: process.env.npm_package_version ?? '0.1.0',
  })
})

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  })
})
setupSentryErrorHandler(app)
app.use(errorHandler)
