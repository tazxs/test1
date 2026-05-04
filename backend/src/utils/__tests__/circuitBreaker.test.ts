import { describe, expect, it, vi } from 'vitest'
import { createExternalCircuit, getCircuitBreakerSnapshots } from '../circuitBreaker'
import { RateLimitError, ServiceDegradedError } from '../errors'

describe('createExternalCircuit', () => {
  it('opens after repeated provider failures and then fails fast as degraded', async () => {
    const action = vi.fn(async (): Promise<string> => {
      throw new Error('Groq 500')
    })
    const circuitName = `groq-test-${Date.now()}`
    const guarded = createExternalCircuit<[], string>(circuitName, action, {
      timeoutMs: 500,
      resetTimeoutMs: 10_000,
      errorThresholdPercentage: 50,
      volumeThreshold: 3,
    })

    await expect(guarded()).rejects.toThrow('Groq 500')
    await expect(guarded()).rejects.toThrow('Groq 500')
    await expect(guarded()).rejects.toBeInstanceOf(ServiceDegradedError)

    const snapshot = getCircuitBreakerSnapshots().find((item) => item.name === circuitName)
    expect(snapshot?.state).toBe('open')
    expect(snapshot?.stats.failures).toBeGreaterThanOrEqual(3)

    await expect(guarded()).rejects.toBeInstanceOf(ServiceDegradedError)
    expect(action).toHaveBeenCalledTimes(3)
  })

  it('does not count RateLimitError as a breaker failure', async () => {
    const action = vi.fn(async (): Promise<string> => {
      throw new RateLimitError()
    })
    const circuitName = `groq-rate-limit-${Date.now()}`
    const guarded = createExternalCircuit<[], string>(circuitName, action, {
      timeoutMs: 500,
      resetTimeoutMs: 10_000,
      errorThresholdPercentage: 50,
      volumeThreshold: 1,
    })

    await expect(guarded()).rejects.toBeInstanceOf(RateLimitError)
    await expect(guarded()).rejects.toBeInstanceOf(RateLimitError)

    const snapshot = getCircuitBreakerSnapshots().find((item) => item.name === circuitName)
    expect(snapshot?.state).toBe('closed')
    expect(snapshot?.stats.failures).toBe(0)
    expect(action).toHaveBeenCalledTimes(2)
  })
})
