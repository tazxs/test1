/**
 * k6 Stress Test — "Last Day Deadline" Scenario 2: Generate Declaration Surge
 *
 * Agent: @Database-SRE
 * Goal: Simulate 500 simultaneous "Generate Declaration" (Form 910.00) requests.
 * Check for row-level locking in PostgreSQL that could freeze the transactions table.
 *
 * Run with: k6 run scripts/k6-last-day-declarations.js
 *
 * Environment variables:
 *   K6_BASE_URL    — API base URL (default: http://localhost:3000)
 *   K6_USER_EMAIL  — Test user email
 *   K6_USER_PASS   — Test user password
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// ── Custom metrics ───────────────────────────────────────────────────────────
const errorRate = new Rate('errors')
const declarationCreateDuration = new Trend('declaration_create_duration', true)
const declarationCalcDuration = new Trend('declaration_calc_duration', true)
const declarationSubmitDuration = new Trend('declaration_submit_duration', true)
const deadlockDetected = new Counter('deadlock_detected')
const lockWaitTimeout = new Counter('lock_wait_timeout')
const gatewayTimeouts = new Counter('gateway_timeouts')
const uniqueConstraintViolations = new Counter('unique_constraint_violations')

// ── Configuration ────────────────────────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000'
const USER_EMAIL = __ENV.K6_USER_EMAIL || 'test@nalogai.kz'
const USER_PASSWORD = __ENV.K6_USER_PASS || 'TestPass123'

/**
 * Staged ramp to 500 VUs for declaration generation.
 *
 * Phase 1: Warm-up — 50 VUs for 15s
 * Phase 2: Ramp to 200 VUs over 30s
 * Phase 3: Ramp to 500 VUs over 30s (peak)
 * Phase 4: Sustain 500 VUs for 2m (steady-state — simulates everyone clicking "Generate" at once)
 * Phase 5: Ramp down over 15s
 */
export const options = {
  stages: [
    { duration: '15s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    // Zero 504 Gateway Timeouts
    gateway_timeouts: ['count<1'],
    // p95 < 500ms under load
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    declaration_create_duration: ['p(95)<500'],
    declaration_calc_duration: ['p(95)<1000'],
    // Error rate < 5% (some unique constraint violations expected)
    errors: ['rate<0.05'],
    // Deadlocks should be zero
    deadlock_detected: ['count<1'],
    lock_wait_timeout: ['count<1'],
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

// ── Generate unique period per VU to avoid unique constraint collisions ──────
function generatePeriod(vuId, iteration) {
  // Each VU gets a unique period to test concurrent writes without unique constraint noise
  // Use a mix of FORM_910 semi-annual periods
  const half = (iteration % 2) === 0 ? 'Q1' : 'Q3'
  return `2025-${half}-vu${vuId}-iter${iteration}`
}

// ── Main test scenario — Declaration generation flow ─────────────────────────
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.accessToken}`,
    'Content-Type': 'application/json',
  }

  const vuId = __VU
  const iteration = __ITER

  group('Generate Declaration (Form 910.00)', () => {
    // Step 1: Create declaration
    group('Create Declaration', () => {
      const period = generatePeriod(vuId, iteration)
      const start = Date.now()
      const res = http.post(
        `${BASE_URL}/api/declarations`,
        JSON.stringify({
          period: period,
          periodType: 'QUARTER',
          formType: 'FORM_910',
        }),
        { headers, timeout: '15s' },
      )
      declarationCreateDuration.add(Date.now() - start)

      const ok = check(res, {
        'create: status 201 or 200': (r) => r.status === 201 || r.status === 200,
        'create: response < 500ms': (r) => r.timings.duration < 500,
      })

      if (!ok) {
        errorRate.add(1)
        if (res.status === 504) gatewayTimeouts.add(1)
        if (res.status === 409) uniqueConstraintViolations.add(1)
        // Check for deadlock indicators in response body
        try {
          const body = res.body || ''
          if (body.includes('deadlock') || body.includes('40P01')) deadlockDetected.add(1)
          if (body.includes('lock timeout') || body.includes('55P03')) lockWaitTimeout.add(1)
        } catch { /* ignore parse errors */ }
      } else {
        errorRate.add(0)
      }

      // Step 2: Calculate tax (triggers transaction aggregation — potential lock contention)
      if (ok) {
        try {
          const declBody = JSON.parse(res.body)
          const declId = declBody.data?.id
          if (declId) {
            group('Calculate Tax', () => {
              const calcStart = Date.now()
              const calcRes = http.post(
                `${BASE_URL}/api/declarations/${declId}/calculate`,
                null,
                { headers, timeout: '15s' },
              )
              declarationCalcDuration.add(Date.now() - calcStart)

              const calcOk = check(calcRes, {
                'calculate: status 200': (r) => r.status === 200,
                'calculate: response < 1000ms': (r) => r.timings.duration < 1000,
                'calculate: has calculation': (r) => {
                  try {
                    const body = JSON.parse(r.body)
                    return body.data?.calculation != null
                  } catch {
                    return false
                  }
                },
              })

              if (!calcOk) {
                errorRate.add(1)
                if (calcRes.status === 504) gatewayTimeouts.add(1)
                try {
                  const body = calcRes.body || ''
                  if (body.includes('deadlock') || body.includes('40P01')) deadlockDetected.add(1)
                  if (body.includes('lock timeout') || body.includes('55P03')) lockWaitTimeout.add(1)
                } catch { /* ignore */ }
              } else {
                errorRate.add(0)
              }
            })
          }
        } catch { /* JSON parse failure — already counted as error */ }
      }
    })
  })

  // Minimal sleep — simulates rapid "last day" clicking
  sleep(Math.random() * 0.5)
}

// ── Teardown ─────────────────────────────────────────────────────────────────
export function teardown(data) {
  if (data.accessToken) {
    http.post(
      `${BASE_URL}/api/auth/logout`,
      null,
      { headers: { Authorization: `Bearer ${data.accessToken}` } },
    )
  }
}
