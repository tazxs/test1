import * as Sentry from '@sentry/react'

const dsn = import.meta.env['VITE_SENTRY_DSN'] as string | undefined
const release = import.meta.env['VITE_SENTRY_RELEASE'] as string | undefined

export function initSentry() {
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release,
    sendDefaultPii: false,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
  })
}

export { Sentry }
