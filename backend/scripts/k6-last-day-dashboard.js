/**
 * k6 Stress Test — "Last Day Deadline" Scenario 1: Dashboard Surge
 *
 * Agent: @Load-Balancer-Expert
 * Goal: Simulate 10,000 concurrent users hitting the Dashboard endpoints.
 * Verify Nginx/Vite proxy handles the surge without dropping connections.
 *
 * Run with: k6 run scripts/k6-last-day-dashboard.js
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
const dashboardDuration = new Trend('dashboard_duration', true)
const healthDuration = new Trend('health_duration', true)
const declarationsListDuration = new Trend('declarations_list_duration', true)
const transactionsListDuration = new Trend('transactions_list_duration', true)
const droppedConnections = new Counter('dropped_connections')
const gatewayTimeouts = new Counter('gateway_timeouts')

// ── Configuration ────────────────────────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000'
const USER_EMAIL = __ENV.K6_USER_EMAIL || 'test@nalogai.kz'
const USER_PASSWORD = __ENV.K6_USER_PASS || 'TestPass123'

/**
 * Staged ramp to 10,000 VUs simulating "last day of tax deadline" traffic.
 *
 * Phase 1: Warm-up — 500 VUs for 30s
 * Phase 2: Ramp to 2,000 VUs over 1m
 * Phase 3: Ramp to 5,000 VUs over 1m
 * Phase 4: Ramp to 10,000 VUs over 1m (peak)
 * Phase 5: Sustain 10,000 VUs for 2m (steady-state)
 * Phase 6: Ramp down over 30s
 */
export const options = {
  stages: [
    { duration: '30s', target: 500 },
    { duration: '1m', target: 2000 },
    { duration: '1m', target: 5000 },
    { duration: '1m', target: 10000 },
    { duration: '2m', target: 10000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Zero 504 Gateway Timeouts
    gateway_timeouts: ['count<1'],
    // p95 < 500ms under load
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // Dashboard-specific endpoints
    dashboard_duration: ['p(95)<500'],
    health_duration: ['p(95)<200'],
    declarations_list_duration: ['p(95)<500'],
    transactions_list_duration: ['p(95)<500'],
    // Error rate < 1%
    errors: ['rate<0.01'],
    // Dropped connections should be zero
    dropped_connections: ['count<1'],
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

// ── Main test scenario — Dashboard user journey ──────────────────────────────
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.accessToken}`,
    'Content-Type': 'application/json',
  }

  group('Dashboard Load', () => {
    // 1. Health check (Nginx proxy passthrough)
    group('Health Check', () => {
      const start = Date.now()
      const res = http.get(`${BASE_URL}/api/health`, { headers, timeout: '10s' })
      healthDuration.add(Date.now() - start)

      const ok = check(res, {
        'health: status 200': (r) => r.status === 200,
        'health: response < 200ms': (r) => r.timings.duration < 200,
      })

      if (!ok) {
        errorRate.add(1)
        if (res.status === 504) gatewayTimeouts.add(1)
        if (res.status === 0) droppedConnections.add(1)
      } else {
        errorRate.add(0)
      }
    })

    // 2. Declarations list (Dashboard shows recent declarations)
    group('Declarations List', () => {
      const start = Date.now()
      const res = http.get(
        `${BASE_URL}/api/declarations?page=1&limit=10`,
        { headers, timeout: '10s' },
      )
      declarationsListDuration.add(Date.now() - start)

      const ok = check(res, {
        'declarations: status 200': (r) => r.status === 200,
        'declarations: has items': (r) => {
          try {
            const body = JSON.parse(r.body)
            return body.success === true
          } catch {
            return false
          }
        },
        'declarations: response < 500ms': (r) => r.timings.duration < 500,
      })

      if (!ok) {
        errorRate.add(1)
        if (res.status === 504) gatewayTimeouts.add(1)
        if (res.status === 0) droppedConnections.add(1)
      } else {
        errorRate.add(0)
      }
    })

    // 3. Transactions list (Dashboard shows recent transactions)
    group('Transactions List', () => {
      const start = Date.now()
      const res = http.get(
        `${BASE_URL}/api/transactions?page=1&limit=20`,
        { headers, timeout: '10s' },
      )
      transactionsListDuration.add(Date.now() - start)

      const ok = check(res, {
        'transactions: status 200': (r) => r.status === 200,
        'transactions: response < 500ms': (r) => r.timings.duration < 500,
      })

      if (!ok) {
        errorRate.add(1)
        if (res.status === 504) gatewayTimeouts.add(1)
        if (res.status === 0) droppedConnections.add(1)
      } else {
        errorRate.add(0)
      }
    })

    // 4. User profile (Dashboard header)
    group('User Profile', () => {
      const start = Date.now()
      const res = http.get(`${BASE_URL}/api/users/me`, { headers, timeout: '10s' })
      dashboardDuration.add(Date.now() - start)

      const ok = check(res, {
        'profile: status 200': (r) => r.status === 200,
        'profile: response < 500ms': (r) => r.timings.duration < 500,
      })

      if (!ok) {
        errorRate.add(1)
        if (res.status === 504) gatewayTimeouts.add(1)
        if (res.status === 0) droppedConnections.add(1)
      } else {
        errorRate.add(0)
      }
    })
  })

  // Simulate realistic user think time (1-3 seconds between page loads)
  sleep(Math.random() * 2 + 1)
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
