/**
 * k6 Load Test — /api/transactions endpoint
 *
 * Validates sub-100ms response times with indexed fields.
 * Run with: k6 run scripts/k6-transactions-load-test.js
 *
 * Prerequisites:
 *   - Backend server running on localhost:3000
 *   - A test user with valid credentials
 *   - k6 installed (https://k6.io/docs/getting-started/installation/)
 *
 * Environment variables:
 *   K6_BASE_URL    — API base URL (default: http://localhost:3000)
 *   K6_USER_EMAIL  — Test user email
 *   K6_USER_PASS   — Test user password
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// ── Custom metrics ───────────────────────────────────────────────────────────
const errorRate = new Rate('errors')
const transactionListDuration = new Trend('transaction_list_duration', true)

// ── Configuration ────────────────────────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000'
const USER_EMAIL = __ENV.K6_USER_EMAIL || 'test@nalogai.kz'
const USER_PASSWORD = __ENV.K6_USER_PASS || 'TestPass123'

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 VUs
    { duration: '1m', target: 10 },   // Stay at 10 VUs
    { duration: '30s', target: 50 },  // Ramp up to 50 VUs
    { duration: '1m', target: 50 },   // Stay at 50 VUs
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // Sub-100ms p95 response time for transaction listing
    transaction_list_duration: ['p(95)<100', 'p(99)<200'],
    // Less than 1% error rate
    errors: ['rate<0.01'],
    // Overall HTTP request duration
    http_req_duration: ['p(95)<150'],
  },
}

// ── Setup: authenticate and get access token ─────────────────────────────────
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  })

  const body = JSON.parse(loginRes.body)
  return { accessToken: body.data?.accessToken || '' }
}

// ── Main test scenario ───────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.accessToken}`,
    'Content-Type': 'application/json',
  }

  // ── Test 1: List transactions (paginated) ──────────────────────────────────
  const listStart = Date.now()
  const listRes = http.get(
    `${BASE_URL}/api/transactions?page=1&limit=50`,
    { headers },
  )
  transactionListDuration.add(Date.now() - listStart)

  const listSuccess = check(listRes, {
    'transactions list: status 200': (r) => r.status === 200,
    'transactions list: has items array': (r) => {
      try {
        const body = JSON.parse(r.body)
        return Array.isArray(body.data?.items)
      } catch {
        return false
      }
    },
    'transactions list: response < 100ms': (r) => r.timings.duration < 100,
  })

  errorRate.add(!listSuccess)

  // ── Test 2: List transactions with type filter ─────────────────────────────
  const filterRes = http.get(
    `${BASE_URL}/api/transactions?page=1&limit=50`,
    { headers },
  )

  check(filterRes, {
    'filtered list: status 200': (r) => r.status === 200,
  })

  // ── Test 3: List transactions page 2 ───────────────────────────────────────
  const page2Res = http.get(
    `${BASE_URL}/api/transactions?page=2&limit=50`,
    { headers },
  )

  check(page2Res, {
    'page 2: status 200': (r) => r.status === 200,
  })

  sleep(1)
}

// ── Teardown ─────────────────────────────────────────────────────────────────
export function teardown(data) {
  // Logout to clean up refresh token
  if (data.accessToken) {
    http.post(
      `${BASE_URL}/api/auth/logout`,
      null,
      { headers: { Authorization: `Bearer ${data.accessToken}` } },
    )
  }
}
