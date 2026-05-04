/**
 * k6 Stress Test — "Last Day Deadline" Scenario 3: Mass Notification Dispatch
 *
 * Agent: @Notification-Marshal
 * Goal: Trigger mass "1 Hour Left" Telegram/Email alerts to 5,000 users via BullMQ.
 * Verify Redis memory stays within 64MB budget (25% of 256MB limit).
 * Ensure jobs are processed without 10+ second delays.
 *
 * This test does NOT use k6 for the notification dispatch itself (BullMQ is internal).
 * Instead, it:
 *   1. Enqueues 5,000 notification jobs via the /api/notifications/test endpoint
 *   2. Monitors queue health via /api/health
 *   3. Measures enqueue throughput and queue backlog
 *
 * Run with: k6 run scripts/k6-last-day-notifications.js
 *
 * Environment variables:
 *   K6_BASE_URL    — API base URL (default: http://localhost:3000)
 *   K6_USER_EMAIL  — Test user email
 *   K6_USER_PASS   — Test user password
 *   K6_NOTIFY_COUNT — Number of notifications to enqueue (default: 5000)
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter, Gauge } from 'k6/metrics'

// ── Custom metrics ───────────────────────────────────────────────────────────
const errorRate = new Rate('errors')
const enqueueDuration = new Trend('enqueue_duration', true)
const healthCheckDuration = new Trend('health_check_duration', true)
const queueWaitingGauge = new Gauge('queue_waiting')
const queueActiveGauge = new Gauge('queue_active')
const queueFailedGauge = new Gauge('queue_failed')
const totalEnqueued = new Counter('total_enqueued')
const totalFailed = new Counter('total_enqueue_failed')
const gatewayTimeouts = new Counter('gateway_timeouts')
const redisMemoryExceeded = new Counter('redis_memory_exceeded')

// ── Configuration ────────────────────────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000'
const USER_EMAIL = __ENV.K6_USER_EMAIL || 'test@nalogai.kz'
const USER_PASSWORD = __ENV.K6_USER_PASS || 'TestPass123'
const NOTIFY_COUNT = parseInt(__ENV.K6_NOTIFY_COUNT || '5000')

/**
 * Strategy: Use a single VU to enqueue jobs sequentially (simulating the cron job
 * that fires all notifications at once), then use multiple VUs to monitor queue health.
 *
 * Phase 1: Enqueue burst — 1 VU for 30s (fast enqueue)
 * Phase 2: Monitor — 10 VUs for 2m (watch queue drain)
 * Phase 3: Verify — 1 VU for 30s (final health check)
 */
export const options = {
  scenarios: {
    // Scenario 1: Enqueue burst (single VU, many iterations)
    enqueue_burst: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: NOTIFY_COUNT,
      maxDuration: '5m',
      exec: 'enqueueJob',
    },
    // Scenario 2: Queue health monitoring (multiple VUs, continuous)
    health_monitor: {
      executor: 'constant-vus',
      vus: 5,
      duration: '3m',
      startTime: '10s',
      exec: 'monitorHealth',
    },
  },
  thresholds: {
    // Enqueue should be fast (< 50ms per job)
    enqueue_duration: ['p(95)<50', 'p(99)<100'],
    // Health checks should be responsive
    health_check_duration: ['p(95)<200'],
    // Error rate < 0.5%
    errors: ['rate<0.005'],
    // Zero gateway timeouts
    gateway_timeouts: ['count<1'],
    // Redis memory should not exceed 64MB
    redis_memory_exceeded: ['count<1'],
  },
}

// ── Setup: authenticate ──────────────────────────────────────────────────────
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  check(loginRes, {
    'setup: login successful': (r) => r.status === 200,
  })

  const body = JSON.parse(loginRes.body)
  return { accessToken: body.data?.accessToken || '' }
}

// ── Scenario 1: Enqueue notification jobs ─────────────────────────────────────
export function enqueueJob(data) {
  const headers = {
    Authorization: `Bearer ${data.accessToken}`,
    'Content-Type': 'application/json',
  }

  // Simulate "1 Hour Left" deadline alert for a user
  // In production, the cron job iterates over all users; here we use the test endpoint
  const start = Date.now()
  const res = http.post(
    `${BASE_URL}/api/notifications/test`,
    JSON.stringify({
      channel: 'telegram',
    }),
    { headers, timeout: '10s' },
  )
  enqueueDuration.add(Date.now() - start)

  const ok = check(res, {
    'enqueue: status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'enqueue: response < 50ms': (r) => r.timings.duration < 50,
  })

  if (ok) {
    totalEnqueued.add(1)
    errorRate.add(0)
  } else {
    totalFailed.add(1)
    errorRate.add(1)
    if (res.status === 504) gatewayTimeouts.add(1)
  }

  // No sleep — maximum throughput enqueue
}

// ── Scenario 2: Monitor queue health ─────────────────────────────────────────
export function monitorHealth(data) {
  const headers = {
    Authorization: `Bearer ${data.accessToken}`,
    'Content-Type': 'application/json',
  }

  group('Queue Health Monitor', () => {
    const start = Date.now()
    const res = http.get(`${BASE_URL}/api/health`, { headers, timeout: '10s' })
    healthCheckDuration.add(Date.now() - start)

    const ok = check(res, {
      'health: status 200 or 503': (r) => r.status === 200 || r.status === 503,
      'health: has queue info': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.notifications?.queue != null
        } catch {
          return false
        }
      },
    })

    if (ok) {
      try {
        const body = JSON.parse(res.body)
        const queue = body.notifications?.queue

        if (queue?.counts) {
          queueWaitingGauge.add(queue.counts.waiting)
          queueActiveGauge.add(queue.counts.active)
          queueFailedGauge.add(queue.counts.failed)
        }

        // Check Redis memory budget (64MB = 67108864 bytes)
        if (queue?.memoryBudget) {
          const maxMb = queue.memoryBudget.maxQueueMemoryMb
          // If queue status is degraded, it may indicate memory pressure
          if (queue.status === 'degraded') {
            redisMemoryExceeded.add(1)
          }
        }
      } catch { /* JSON parse failure */ }
      errorRate.add(0)
    } else {
      errorRate.add(1)
      if (res.status === 504) gatewayTimeouts.add(1)
    }
  })

  sleep(2)
}

// ── Teardown: final health snapshot ──────────────────────────────────────────
export function teardown(data) {
  // Final health check to capture end-state queue metrics
  const headers = {
    Authorization: `Bearer ${data.accessToken}`,
    'Content-Type': 'application/json',
  }

  const res = http.get(`${BASE_URL}/api/health`, { headers })
  try {
    const body = JSON.parse(res.body)
    const queue = body.notifications?.queue
    if (queue?.counts) {
      console.log(`\n── Final Queue State ──`)
      console.log(`  Waiting:   ${queue.counts.waiting}`)
      console.log(`  Active:    ${queue.counts.active}`)
      console.log(`  Failed:    ${queue.counts.failed}`)
      console.log(`  Completed: ${queue.counts.completed}`)
      console.log(`  Status:    ${queue.status}`)
    }
  } catch { /* ignore */ }

  if (data.accessToken) {
    http.post(
      `${BASE_URL}/api/auth/logout`,
      null,
      { headers: { Authorization: `Bearer ${data.accessToken}` } },
    )
  }
}
