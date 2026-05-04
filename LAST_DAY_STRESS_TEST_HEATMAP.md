# NalogAI: Scalability Heatmap — "Last Day Deadline" Stress Test

**Date:** 2026-05-02
**Status:** 📋 Test Suite Ready — Awaiting Execution

---

## Executive Summary

This document defines the "Last Day Deadline" concurrency stress test for the NalogAI platform.
It simulates the worst-case scenario: thousands of self-employed taxpayers in Kazakhstan
all trying to file their Form 910.00 declarations on the last day before the tax deadline.

**Goal:** Zero 504 Gateway Timeouts and consistent p95 < 500ms under load.

---

## Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    k6 Load Generator                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Scenario 1   │  │  Scenario 2   │  │    Scenario 3        │  │
│  │  Dashboard    │  │  Declarations │  │    Notifications     │  │
│  │  10,000 VUs   │  │  500 VUs      │  │    5,000 jobs        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                          │
│              (worker_connections: default 768)                  │
│              (proxy_read_timeout: 60s)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js Backend                           │
│              (rate-limit: 100 req/15min)                        │
│              (compression: enabled)                             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  /api/health │  │ /api/decls  │  │ /api/notifications/test │ │
│  │  /api/users  │  │ /api/txns   │  │                         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────────┘ │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   PostgreSQL     │  │   PostgreSQL     │  │   Redis          │
│   (pgvector)     │  │   (pgvector)     │  │   (BullMQ)       │
│                  │  │                  │  │                  │
│   max_conn: 100  │  │   Row locks on   │  │   Budget: 64MB   │
│   Pool: default  │  │   declarations   │  │   Worker: 5      │
│                  │  │   + transactions │  │   concurrency    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Scenarios

### Scenario 1: Dashboard Surge — @Load-Balancer-Expert

**File:** [`k6-last-day-dashboard.js`](nalogai/backend/scripts/k6-last-day-dashboard.js)

| Parameter | Value |
|-----------|-------|
| Peak VUs | 10,000 |
| Duration | ~6 minutes |
| Ramp Pattern | 500 → 2,000 → 5,000 → 10,000 (sustained 2min) |
| Think Time | 1–3 seconds (realistic user behavior) |

**Endpoints exercised per VU iteration:**
1. `GET /api/health` — Health check (Nginx proxy passthrough)
2. `GET /api/declarations?page=1&limit=10` — Declarations list
3. `GET /api/transactions?page=1&limit=20` — Transactions list
4. `GET /api/users/me` — User profile

**Thresholds:**
| Metric | Target |
|--------|--------|
| p95 HTTP Duration | < 500ms |
| p99 HTTP Duration | < 1000ms |
| 504 Gateway Timeouts | 0 |
| Dropped Connections | 0 |
| Error Rate | < 1% |

**What to watch for:**
- Nginx `worker_connections` exhaustion (default 768)
- TCP connection queue buildup
- Rate limiter rejecting legitimate traffic (100 req/15min)
- Backend connection pool saturation

---

### Scenario 2: Declaration Surge — @Database-SRE

**File:** [`k6-last-day-declarations.js`](nalogai/backend/scripts/k6-last-day-declarations.js)

| Parameter | Value |
|-----------|-------|
| Peak VUs | 500 |
| Duration | ~4 minutes |
| Ramp Pattern | 50 → 200 → 500 (sustained 2min) |
| Think Time | 0–0.5 seconds (rapid "last day" clicking) |

**Operations per VU iteration:**
1. `POST /api/declarations` — Create Form 910.00 declaration
2. `POST /api/declarations/:id/calculate` — Calculate tax (triggers transaction aggregation)

**Thresholds:**
| Metric | Target |
|--------|--------|
| p95 Create Duration | < 500ms |
| p95 Calculate Duration | < 1000ms |
| 504 Gateway Timeouts | 0 |
| Deadlocks Detected | 0 |
| Lock Wait Timeouts | 0 |
| Error Rate | < 5% |

**What to watch for:**
- PostgreSQL row-level locking on `declarations` table (upsert with unique constraint)
- `prisma.transaction.aggregate()` acquiring `FOR SHARE` locks
- Connection pool exhaustion (Prisma default = NumCPUs)
- Deadlock detection (PostgreSQL error code `40P01`)
- Lock wait timeout (PostgreSQL error code `55P03`)

---

### Scenario 3: Notification Surge — @Notification-Marshal

**File:** [`k6-last-day-notifications.js`](nalogai/backend/scripts/k6-last-day-notifications.js)

| Parameter | Value |
|-----------|-------|
| Jobs Enqueued | 5,000 |
| Duration | ~3 minutes |
| Enqueue Strategy | Single VU, max throughput (no sleep) |
| Health Monitors | 5 VUs polling every 2 seconds |

**Operations:**
1. `POST /api/notifications/test` — Enqueue notification job (×5,000)
2. `GET /api/health` — Monitor queue health (waiting/active/failed counts)

**Thresholds:**
| Metric | Target |
|--------|--------|
| p95 Enqueue Duration | < 50ms |
| Redis Memory | < 64MB (25% of 256MB limit) |
| Queue Processing Delay | < 10 seconds |
| 504 Gateway Timeouts | 0 |
| Error Rate | < 0.5% |

**What to watch for:**
- Redis memory consumption (each job ≈ 500 bytes → 5,000 jobs ≈ 2.5MB)
- BullMQ worker throughput (concurrency = 5)
- Queue backlog growth rate
- Worker DB read pressure (5,000 `prisma.user.findUnique()` calls)

---

## Scalability Heatmap

| Load Level | Dashboard (VUs) | Declarations (VUs) | Notifications (Jobs) | Expected Behavior |
|------------|-----------------|--------------------|--------------------|-------------------|
| 🟢 **Normal** | 0–100 | 0–10 | 0–100 | All green, p95 < 100ms |
| 🟡 **Moderate** | 100–1,000 | 10–50 | 100–1,000 | p95 < 200ms, rate limiter starts kicking in |
| 🟠 **High** | 1,000–5,000 | 50–200 | 1,000–3,000 | p95 < 500ms, connection pool pressure |
| 🔴 **Critical** | 5,000–10,000 | 200–500 | 3,000–5,000 | p95 may exceed 500ms, 504s possible |
| ⚫ **Collapse** | > 10,000 | > 500 | > 5,000 | Connection exhaustion, cascading failures |

---

## Bottleneck Analysis

### Nginx / Reverse Proxy

| Issue | Severity | Current | Recommendation |
|-------|----------|---------|----------------|
| `worker_connections` too low | 🔴 High | 768 (default) | Set `worker_connections 4096;` |
| No upstream keepalive | 🔴 High | None | Add `keepalive 64;` to upstream block |
| `proxy_read_timeout` too long | 🟡 Medium | 60s | Reduce to 15s for API endpoints |
| No `proxy_buffering` tuning | 🟡 Medium | Default | Enable with `proxy_buffer_size 8k;` |

### PostgreSQL

| Issue | Severity | Current | Recommendation |
|-------|----------|---------|----------------|
| `max_connections` too low | 🔴 High | 100 (default) | Increase to 200 or use PgBouncer |
| No connection pool tuning | 🔴 High | Prisma default (NumCPUs) | Set `connection_limit=20` |
| Transaction aggregation locks | 🟡 Medium | Default isolation | Use `REPEATABLE READ` for calculate |
| No `statement_timeout` | 🟡 Medium | None | Set 30s timeout |

### Redis / BullMQ

| Issue | Severity | Current | Recommendation |
|-------|----------|---------|----------------|
| Worker concurrency = 5 | 🟡 Medium | 5 | Increase to 10–20 for bursts |
| No `maxmemory` policy | 🟡 Medium | None | Set `maxmemory 256mb` + `allkeys-lru` |
| Per-job DB read | 🟡 Medium | 1 read per job | Batch user lookups or cache |

### Rate Limiting

| Issue | Severity | Current | Recommendation |
|-------|----------|---------|----------------|
| 100 req/15min global | 🔴 High | 100/15min | Raise to 500/15min for deadline periods |
| No per-endpoint limits | 🟡 Medium | Global only | Add higher limits for dashboard |
| No burst allowance | 🟡 Medium | None | Allow short bursts above sustained rate |

---

## Recommendations (Priority Order)

1. **🔴 CRITICAL:** Increase Nginx `worker_connections` to 4096 and add upstream keepalive
2. **🔴 CRITICAL:** Add PgBouncer or increase PostgreSQL `max_connections` to 200+
3. **🔴 CRITICAL:** Raise rate limits for dashboard endpoints during deadline periods
4. **🟡 IMPORTANT:** Increase BullMQ worker concurrency to 10–20
5. **🟡 IMPORTANT:** Set Prisma `connection_limit=20` in datasource configuration
6. **🟡 IMPORTANT:** Add Redis `maxmemory 256mb` with `allkeys-lru` eviction
7. **🟢 NICE-TO-HAVE:** Add response caching for dashboard endpoints (30s TTL)
8. **🟢 NICE-TO-HAVE:** Implement request coalescing for duplicate declaration calculations

---

## How to Run

### Prerequisites
- [k6 installed](https://k6.io/docs/getting-started/installation/)
- Backend running on `localhost:3000`
- Redis running on `localhost:6379`
- PostgreSQL running on `localhost:5434`

### Run Individual Scenarios

```bash
# Scenario 1: Dashboard Surge
k6 run nalogai/backend/scripts/k6-last-day-dashboard.js

# Scenario 2: Declaration Surge
k6 run nalogai/backend/scripts/k6-last-day-declarations.js

# Scenario 3: Notification Surge
k6 run nalogai/backend/scripts/k6-last-day-notifications.js
```

### Run Full Orchestrated Suite

```bash
# Linux/macOS
cd nalogai/backend && bash scripts/k6-last-day-orchestrator.sh

# Windows PowerShell
cd nalogai/backend; powershell -ExecutionPolicy Bypass -File scripts/k6-last-day-orchestrator.ps1
```

### Custom Configuration

```bash
# Custom base URL and credentials
K6_BASE_URL=https://staging.nalogai.kz \
K6_USER_EMAIL=loadtest@nalogai.kz \
K6_USER_PASS=SecurePass123 \
K6_NOTIFY_COUNT=10000 \
k6 run nalogai/backend/scripts/k6-last-day-notifications.js
```

---

## Files

| File | Purpose |
|------|---------|
| [`k6-last-day-dashboard.js`](nalogai/backend/scripts/k6-last-day-dashboard.js) | Scenario 1: 10K VU dashboard surge |
| [`k6-last-day-declarations.js`](nalogai/backend/scripts/k6-last-day-declarations.js) | Scenario 2: 500 VU declaration generation |
| [`k6-last-day-notifications.js`](nalogai/backend/scripts/k6-last-day-notifications.js) | Scenario 3: 5K notification enqueue |
| [`k6-last-day-orchestrator.sh`](nalogai/backend/scripts/k6-last-day-orchestrator.sh) | Linux/macOS orchestrator |
| [`k6-last-day-orchestrator.ps1`](nalogai/backend/scripts/k6-last-day-orchestrator.ps1) | Windows PowerShell orchestrator |
