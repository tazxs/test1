import type CircuitBreaker from 'opossum'
import { createRequire } from 'module'
import { AppError, RateLimitError, ServiceDegradedError } from './errors'
import { logger } from './logger'

type CircuitState = 'closed' | 'open' | 'halfOpen'

interface CircuitRecord {
  name: string
  breaker: CircuitBreaker<unknown[], unknown>
  state: CircuitState
  openedAt?: string
  lastFailureAt?: string
  lastFailure?: string
}

export interface CircuitBreakerSnapshot {
  name: string
  state: CircuitState
  openedAt?: string
  lastFailureAt?: string
  lastFailure?: string
  stats: {
    fires: number
    successes: number
    failures: number
    rejects: number
    timeouts: number
    latencyMean?: number
  }
}

export interface ExternalCircuitOptions {
  timeoutMs?: number
  errorThresholdPercentage?: number
  resetTimeoutMs?: number
  rollingCountTimeoutMs?: number
  volumeThreshold?: number
}

const circuits = new Map<string, CircuitRecord>()
const requireModule = createRequire(__filename)

type CircuitBreakerConstructor = new <TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options?: {
    timeout?: number
    errorThresholdPercentage?: number
    resetTimeout?: number
    rollingCountTimeout?: number
    volumeThreshold?: number
    name?: string
    errorFilter?: (error: unknown) => boolean
  },
) => CircuitBreaker<TArgs, TResult>

function loadCircuitBreaker(): CircuitBreakerConstructor | null {
  try {
    const imported = requireModule('opossum') as { default?: CircuitBreakerConstructor } | CircuitBreakerConstructor
    if (typeof imported === 'function') return imported
    return imported.default ?? null
  } catch (err) {
    logger.warn('opossum is unavailable; circuit breaker disabled', { err })
    return null
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function isBreakerOpenError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.name === 'OpenBreakerError' || err.message.toLowerCase().includes('breaker is open')
}

export function createExternalCircuit<TArgs extends unknown[], TResult>(
  name: string,
  action: (...args: TArgs) => Promise<TResult>,
  options: ExternalCircuitOptions = {},
): (...args: TArgs) => Promise<TResult> {
  const CircuitBreakerClass = loadCircuitBreaker()
  if (!CircuitBreakerClass) return action

  const breaker = new CircuitBreakerClass<TArgs, TResult>(action, {
    name,
    timeout: options.timeoutMs ?? 20_000,
    errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
    resetTimeout: options.resetTimeoutMs ?? 30_000,
    rollingCountTimeout: options.rollingCountTimeoutMs ?? 60_000,
    volumeThreshold: options.volumeThreshold ?? 3,
    errorFilter: (err) => err instanceof RateLimitError,
  })

  const record: CircuitRecord = {
    name,
    breaker: breaker as CircuitBreaker<unknown[], unknown>,
    state: 'closed',
  }
  circuits.set(name, record)

  breaker.on('open', () => {
    record.state = 'open'
    record.openedAt = new Date().toISOString()
    logger.warn('Circuit breaker opened', { circuit: name })
  })
  breaker.on('halfOpen', () => {
    record.state = 'halfOpen'
    logger.info('Circuit breaker half-open', { circuit: name })
  })
  breaker.on('close', () => {
    record.state = 'closed'
    record.openedAt = undefined
    logger.info('Circuit breaker closed', { circuit: name })
  })
  breaker.on('failure', (err) => {
    record.lastFailureAt = new Date().toISOString()
    record.lastFailure = errorMessage(err)
    logger.warn('Circuit breaker recorded failure', {
      circuit: name,
      err: err instanceof Error ? err : undefined,
      error: err instanceof Error ? undefined : String(err),
    })
  })

  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await breaker.fire(...args)
    } catch (err) {
      if (err instanceof RateLimitError || err instanceof AppError) throw err
      if (isBreakerOpenError(err) || record.state === 'open') {
        throw new ServiceDegradedError(name)
      }
      throw err
    }
  }
}

export function getCircuitBreakerSnapshots(): CircuitBreakerSnapshot[] {
  return [...circuits.values()].map((record) => ({
    name: record.name,
    state: record.state,
    openedAt: record.openedAt,
    lastFailureAt: record.lastFailureAt,
    lastFailure: record.lastFailure,
    stats: {
      fires: record.breaker.stats.fires ?? 0,
      successes: record.breaker.stats.successes ?? 0,
      failures: record.breaker.stats.failures ?? 0,
      rejects: record.breaker.stats.rejects ?? 0,
      timeouts: record.breaker.stats.timeouts ?? 0,
      latencyMean: record.breaker.stats.latencyMean,
    },
  }))
}
