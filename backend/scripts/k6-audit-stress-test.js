/**
 * k6 Stress Test — Audit Logging Overhead
 *
 * Simulates 5,000 concurrent VUs rapidly creating and updating transactions
 * to measure the performance impact of the Zero-Trust Audit System.
 *
 * Run with: k6 run scripts/k6-audit-stress-test.js
 *
 * Prerequisites:
 *   - Backend server running on localhost:3000
 *   - PostgreSQL with audit_logs table migrated
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
const transactionCreateDuration = new Trend('transaction_create_duration', true)
const transactionUpdateDuration = new Trend('transaction_update_duration', true)
const transactionDeleteDuration = new Trend('transaction_delete_duration', true)
const auditOverhead = new Trend('audit_overhead_ms', true)

// ── Configuration ────────────────────────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000'
const USER_EMAIL = __ENV.K6_USER_EMAIL || 'stress@nalogai.kz'
const USER_PASSWORD = __ENV.K6_USER_PASS || 'StressTest123!'

export const options = {
  stages: [
    { duration: '30s', target: 500 },   // Ramp up to 500 VUs
    { duration: '1m', target: 2000 },    // Ramp up to 2000 VUs
    { duration: '2m', target: 5000 },    // Peak: 5000 VUs (Last Day Deadline pressure)
    { duration: '2m', target: 5000 },    // Sustain peak for 2 minutes
    { duration: '1m', target: 1000 },    // Ramp down to 1000
    { duration: '30s', target: 0 },      // Cool down
  ],
  thresholds: {
    // P95 database response time must stay below 150ms even with audit logging
    transaction_create_duration: ['p(95)<150', 'p(99)<300'],
    transaction_update_duration: ['p(95)<150', 'p(99)<300'],
    transaction_delete_duration: ['p(95)<150', 'p(99)<300'],
    // Audit overhead should be minimal (< 50ms added per request)
    audit_overhead_ms: ['p(95)<50', 'p(99)<100'],
    // Less than 2% error rate under extreme load
    errors: ['rate<0.02'],
    // Overall HTTP request duration
    http_req_duration: ['p(95)<200', 'p(99)<500'],
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

// ── Categories for realistic transaction variety ─────────────────────────────
const INCOME_CATEGORIES = [
  'SERVICES_INCOME', 'GOODS_INCOME', 'CONSULTING_INCOME',
  'FREELANCE_INCOME', 'RENT_INCOME', 'OTHER_INCOME',
]
const EXPENSE_CATEGORIES = [
  'OFFICE_EXPENSES', 'EQUIPMENT_EXPENSES', 'MARKETING_EXPENSES',
  'TRANSPORT_EXPENSES', 'UTILITIES_EXPENSES', 'OTHER_EXPENSES',
]

function randomCategory(type) {
  const cats = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return cats[Math.floor(Math.random() * cats.length)]
}

function randomAmount() {
  return Math.floor(Math.random() * 500000) + 1000 // 1,000 — 501,000 ₸
}

// ── Main test scenario ───────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.accessToken}`,
    'Content-Type': 'application/json',
  }

  const type = Math.random() > 0.4 ? 'INCOME' : 'EXPENSE'
  const amount = randomAmount()
  const category = randomCategory(type)

  // ── Test 1: Create transaction (triggers audit log with network identity) ───
  const createStart = Date.now()
  const createRes = http.post(
    `${BASE_URL}/api/transactions`,
    JSON.stringify({
      amount,
      type,
      category,
      description: `Stress test ${type.toLowerCase()} ${amount} ₸`,
      date: '2026-05-04',
      source: 'MANUAL',
    }),
    { headers },
  )
  const createDuration = Date.now() - createStart
  transactionCreateDuration.add(createDuration)

  const createSuccess = check(createRes, {
    'transaction created': (r) => r.status === 201,
  })

  if (!createSuccess) {
    errorRate.add(1)
    return
  }

  const txId = JSON.parse(createRes.body).data?.id
  if (!txId) {
    errorRate.add(1)
    return
  }

  // ── Test 2: Update transaction (triggers audit log with old/new snapshots) ──
  const updateStart = Date.now()
  const updateRes = http.patch(
    `${BASE_URL}/api/transactions/${txId}`,
    JSON.stringify({
      category: randomCategory(type),
      description: `Updated stress test ${amount} ₸`,
    }),
    { headers },
  )
  const updateDuration = Date.now() - updateStart
  transactionUpdateDuration.add(updateDuration)

  check(updateRes, {
    'transaction updated': (r) => r.status === 200,
  }) || errorRate.add(1)

  // ── Test 3: Delete transaction (triggers audit log with deleted snapshot) ───
  const deleteStart = Date.now()
  const deleteRes = http.del(
    `${BASE_URL}/api/transactions/${txId}`,
    null,
    { headers },
  )
  const deleteDuration = Date.now() - deleteStart
  transactionDeleteDuration.add(deleteDuration)

  check(deleteRes, {
    'transaction deleted': (r) => r.status === 200,
  }) || errorRate.add(1)

  // Estimate audit overhead (create duration minus a baseline of ~20ms for pure DB write)
  // This is approximate — real overhead requires A/B comparison
  auditOverhead.add(Math.max(0, createDuration - 20))

  sleep(0.1) // 100ms think time between operations
}

// ── Teardown: summary report ─────────────────────────────────────────────────
export function teardown(data) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           AUDIT LOGGING STRESS TEST — SCALABILITY HEATMAP       ║
╠══════════════════════════════════════════════════════════════════╣
║  Peak VUs:           5,000                                      ║
║  Test Duration:      ~7 minutes                                 ║
║  Operations/VU:      Create + Update + Delete = 3 audit logs    ║
║                                                                  ║
║  Thresholds:                                                     ║
║  ├─ Transaction CRUD P95:  < 150ms                              ║
║  ├─ Audit Overhead P95:    < 50ms                               ║
║  ├─ Error Rate:            < 2%                                 ║
║  └─ Overall P95:           < 200ms                              ║
║                                                                  ║
║  If P95 > 150ms:                                                 ║
║  → Consider async audit logging (fire-and-forget with queue)    ║
║  → Add connection pooling for audit_logs writes                 ║
║  → Partition audit_logs by month for faster inserts             ║
╚══════════════════════════════════════════════════════════════════╝
  `)
}
