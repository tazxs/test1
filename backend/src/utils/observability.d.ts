declare module '@sentry/node' {
  import type { Express } from 'express'

  export interface NodeOptions {
    dsn?: string
    environment?: string
    release?: string
    tracesSampleRate?: number
    [key: string]: unknown
  }

  export interface CaptureContext {
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
    tags?: Record<string, string>
    extra?: Record<string, unknown>
    user?: {
      id?: string
      email?: string
      username?: string
      [key: string]: unknown
    }
  }

  export function init(options: NodeOptions): void
  export function captureException(error: unknown, context?: CaptureContext): string
  export function captureMessage(message: string, context?: CaptureContext): string
  export function flush(timeout?: number): Promise<boolean>
  export function setupExpressErrorHandler(app: Express): void
}

declare module 'opossum' {
  type Listener = (...args: unknown[]) => void

  interface CircuitBreakerOptions {
    timeout?: number
    errorThresholdPercentage?: number
    resetTimeout?: number
    rollingCountTimeout?: number
    rollingCountBuckets?: number
    volumeThreshold?: number
    name?: string
    errorFilter?: (error: unknown) => boolean
    [key: string]: unknown
  }

  interface CircuitBreakerStats {
    failures?: number
    fallbacks?: number
    successes?: number
    rejects?: number
    fires?: number
    timeouts?: number
    cacheHits?: number
    cacheMisses?: number
    semaphoreRejections?: number
    percentiles?: Record<string, number>
    latencyMean?: number
    [key: string]: unknown
  }

  export default class CircuitBreaker<TArgs extends unknown[] = unknown[], TResult = unknown> {
    constructor(action: (...args: TArgs) => Promise<TResult>, options?: CircuitBreakerOptions)
    fire(...args: TArgs): Promise<TResult>
    on(event: string, listener: Listener): this
    readonly opened: boolean
    readonly closed: boolean
    readonly halfOpen: boolean
    readonly stats: CircuitBreakerStats
  }
}
