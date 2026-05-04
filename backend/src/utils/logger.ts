import winston from 'winston'

const { combine, timestamp, colorize, printf, json, errors } = winston.format

const REDACTED_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'clientsecret',
  'signedxml',
  // PII — Kazakhstan personal data (never log these)
  'iin',
  'paymentdetails',
  'cardnumber',
  'cvv',
  'cardholder',
  'cardtoken',
  'refreshtokenraw',
])

function sanitize(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      clean[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : sanitize(nested)
    }
    return clean
  }
  return value
}

const sanitizeFormat = winston.format((info) => {
  for (const [key, value] of Object.entries(info)) {
    if (key === 'level' || key === 'message' || key === 'timestamp') continue
    info[key] = sanitize(value)
  }
  return info
})

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${ts} [${level}] ${message}${metaStr}`
})

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? combine(timestamp(), errors({ stack: true }), sanitizeFormat(), json())
          : combine(timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), sanitizeFormat(), colorize(), devFormat),
    }),
  ],
})
