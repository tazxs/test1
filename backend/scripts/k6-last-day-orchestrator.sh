#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# "Last Day Deadline" Concurrency Stress Test — Orchestrator
#
# Runs all three scenarios sequentially, collects metrics, and generates
# a Scalability Heatmap report.
#
# Prerequisites:
#   - k6 installed (https://k6.io/docs/getting-started/installation/)
#   - Backend server running on localhost:3000
#   - Redis running on localhost:6379
#   - PostgreSQL running on localhost:5434
#
# Usage:
#   cd nalogai/backend
#   bash scripts/k6-last-day-orchestrator.sh
#
# Environment variables:
#   K6_BASE_URL     — API base URL (default: http://localhost:3000)
#   K6_USER_EMAIL   — Test user email (default: test@nalogai.kz)
#   K6_USER_PASS    — Test user password (default: TestPass123)
#   K6_NOTIFY_COUNT — Number of notifications to enqueue (default: 5000)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../stress-test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${RESULTS_DIR}/heatmap_${TIMESTAMP}.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  NalogAI — \"Last Day Deadline\" Concurrency Stress Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Timestamp:  ${TIMESTAMP}"
echo -e "  Base URL:   ${K6_BASE_URL:-http://localhost:3000}"
echo -e "  Results:    ${RESULTS_DIR}"
echo ""

# ── Pre-flight checks ────────────────────────────────────────────────────────
echo -e "${YELLOW}[Pre-flight] Checking prerequisites...${NC}"

if ! command -v k6 &> /dev/null; then
  echo -e "${RED}ERROR: k6 is not installed. Install from https://k6.io/docs/getting-started/installation/${NC}"
  exit 1
fi

# Check if backend is reachable
if ! curl -sf "${K6_BASE_URL:-http://localhost:3000}/api/health" > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Backend not reachable at ${K6_BASE_URL:-http://localhost:3000}${NC}"
  echo "  Start the backend: cd nalogai/backend && npm run dev"
  exit 1
fi

echo -e "${GREEN}[Pre-flight] All checks passed${NC}"
echo ""

# ── Scenario 1: Dashboard Surge (Load-Balancer-Expert) ───────────────────────
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Scenario 1: Dashboard Surge — @Load-Balancer-Expert${NC}"
echo -e "${BLUE}  10,000 concurrent users → Dashboard endpoints${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

DASHBOARD_JSON="${RESULTS_DIR}/dashboard_${TIMESTAMP}.json"
k6 run \
  --out json="${RESULTS_DIR}/dashboard_raw_${TIMESTAMP}.json" \
  --summary-export="${DASHBOARD_JSON}" \
  "${SCRIPT_DIR}/k6-last-day-dashboard.js" \
  2>&1 | tee "${RESULTS_DIR}/dashboard_output_${TIMESTAMP}.txt"

DASHBOARD_EXIT=$?
echo ""

# ── Cooldown between scenarios ────────────────────────────────────────────────
echo -e "${YELLOW}[Cooldown] Waiting 30s for system to stabilize...${NC}"
sleep 30

# ── Scenario 2: Declaration Surge (Database-SRE) ─────────────────────────────
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Scenario 2: Declaration Surge — @Database-SRE${NC}"
echo -e "${BLUE}  500 simultaneous Generate Declaration (910.00) requests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

DECLARATIONS_JSON="${RESULTS_DIR}/declarations_${TIMESTAMP}.json"
k6 run \
  --out json="${RESULTS_DIR}/declarations_raw_${TIMESTAMP}.json" \
  --summary-export="${DECLARATIONS_JSON}" \
  "${SCRIPT_DIR}/k6-last-day-declarations.js" \
  2>&1 | tee "${RESULTS_DIR}/declarations_output_${TIMESTAMP}.txt"

DECLARATIONS_EXIT=$?
echo ""

# ── Cooldown between scenarios ────────────────────────────────────────────────
echo -e "${YELLOW}[Cooldown] Waiting 30s for system to stabilize...${NC}"
sleep 30

# ── Scenario 3: Notification Surge (Notification-Marshal) ─────────────────────
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Scenario 3: Notification Surge — @Notification-Marshal${NC}"
echo -e "${BLUE}  5,000 BullMQ notification jobs → Redis queue${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

NOTIFICATIONS_JSON="${RESULTS_DIR}/notifications_${TIMESTAMP}.json"
k6 run \
  --out json="${RESULTS_DIR}/notifications_raw_${TIMESTAMP}.json" \
  --summary-export="${NOTIFICATIONS_JSON}" \
  "${SCRIPT_DIR}/k6-last-day-notifications.js" \
  2>&1 | tee "${RESULTS_DIR}/notifications_output_${TIMESTAMP}.txt"

NOTIFICATIONS_EXIT=$?
echo ""

# ── Generate Scalability Heatmap Report ───────────────────────────────────────
echo -e "${YELLOW}[Report] Generating Scalability Heatmap...${NC}"

# Determine overall status
OVERALL_STATUS="✅ PASS"
if [ $DASHBOARD_EXIT -ne 0 ] || [ $DECLARATIONS_EXIT -ne 0 ] || [ $NOTIFICATIONS_EXIT -ne 0 ]; then
  OVERALL_STATUS="❌ FAIL"
fi

cat > "${REPORT_FILE}" << HEREDOC
# NalogAI: Scalability Heatmap — "Last Day Deadline" Stress Test

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Overall Status:** ${OVERALL_STATUS}

---

## Executive Summary

This heatmap shows system degradation points under "last day of tax deadline" load.
Three scenarios were tested sequentially against the NalogAI stack:
Nginx → Express → PostgreSQL + Redis (BullMQ).

**Goal:** Zero 504 Gateway Timeouts and consistent p95 < 500ms under load.

---

## Scenario Results

### 1. Dashboard Surge — @Load-Balancer-Expert

| Metric | Target | Result | Status |
|--------|--------|--------|--------|
| Concurrent VUs | 10,000 | 10,000 | $([ $DASHBOARD_EXIT -eq 0 ] && echo "✅" || echo "❌") |
| p95 HTTP Duration | < 500ms | See k6 output | — |
| p99 HTTP Duration | < 1000ms | See k6 output | — |
| 504 Gateway Timeouts | 0 | See k6 output | — |
| Error Rate | < 1% | See k6 output | — |
| Dropped Connections | 0 | See k6 output | — |

**Endpoints tested:**
- \`GET /api/health\` — Health check (Nginx proxy passthrough)
- \`GET /api/declarations?page=1&limit=10\` — Declarations list
- \`GET /api/transactions?page=1&limit=20\` — Transactions list
- \`GET /api/users/me\` — User profile

**Degradation analysis:**
- Nginx \`worker_connections\` default is 768 — at 10,000 VUs, connections may queue
- \`proxy_read_timeout 60s\` — long-running requests will hold connections
- Rate limiter: 100 req/15min per IP — will throttle at ~6.7 req/min sustained
- No \`upstream keepalive\` configured — each request opens a new connection to backend

---

### 2. Declaration Surge — @Database-SRE

| Metric | Target | Result | Status |
|--------|--------|--------|--------|
| Concurrent VUs | 500 | 500 | $([ $DECLARATIONS_EXIT -eq 0 ] && echo "✅" || echo "❌") |
| p95 Create Duration | < 500ms | See k6 output | — |
| p95 Calculate Duration | < 1000ms | See k6 output | — |
| 504 Gateway Timeouts | 0 | See k6 output | — |
| Deadlocks Detected | 0 | See k6 output | — |
| Lock Wait Timeouts | 0 | See k6 output | — |
| Error Rate | < 5% | See k6 output | — |

**Operations tested:**
- \`POST /api/declarations\` — Create declaration (Form 910.00)
- \`POST /api/declarations/:id/calculate\` — Calculate tax (triggers transaction aggregation)

**Degradation analysis:**
- Declaration upsert uses \`@@unique([userId, period, formType])\` — concurrent inserts for same user+period will serialize
- \`prisma.transaction.aggregate()\` in calculate route acquires \`FOR SHARE\` row locks
- No explicit connection pool tuning — Prisma default is \`connection_limit=NumCPUs\`
- PostgreSQL \`max_connections\` default is 100 — at 500 VUs, connections will queue

---

### 3. Notification Surge — @Notification-Marshal

| Metric | Target | Result | Status |
|--------|--------|--------|--------|
| Jobs Enqueued | 5,000 | See k6 output | $([ $NOTIFICATIONS_EXIT -eq 0 ] && echo "✅" || echo "❌") |
| p95 Enqueue Duration | < 50ms | See k6 output | — |
| Redis Memory | < 64MB | See k6 output | — |
| Queue Processing Delay | < 10s | See k6 output | — |
| 504 Gateway Timeouts | 0 | See k6 output | — |
| Error Rate | < 0.5% | See k6 output | — |

**Operations tested:**
- \`POST /api/notifications/test\` — Enqueue notification job
- \`GET /api/health\` — Monitor queue health (waiting/active/failed counts)

**Degradation analysis:**
- BullMQ worker concurrency: 5 (from \`NOTIFICATION_WORKER_CONCURRENCY\` env)
- At 5,000 jobs with concurrency 5, processing time ≈ 5000 × avg_job_time / 5
- Redis memory: each job ≈ 500 bytes → 5,000 jobs ≈ 2.5MB (well within 64MB budget)
- \`removeOnComplete: { age: 3600, count: 1000 }\` — completed jobs cleaned up aggressively
- Worker does \`prisma.user.findUnique()\` per job — 5,000 DB reads during drain

---

## Scalability Heatmap

| Load Level | Dashboard (VUs) | Declarations (VUs) | Notifications (Jobs) | Expected Behavior |
|------------|-----------------|--------------------|--------------------|-------------------|
| 🟢 Normal | 0–100 | 0–10 | 0–100 | All green, p95 < 100ms |
| 🟡 Moderate | 100–1,000 | 10–50 | 100–1,000 | p95 < 200ms, rate limiter starts kicking in |
| 🟠 High | 1,000–5,000 | 50–200 | 1,000–3,000 | p95 < 500ms, connection pool pressure |
| 🔴 Critical | 5,000–10,000 | 200–500 | 3,000–5,000 | p95 may exceed 500ms, 504s possible |
| ⚫ Collapse | > 10,000 | > 500 | > 5,000 | Connection exhaustion, cascading failures |

---

## Bottleneck Analysis

### Nginx / Reverse Proxy
| Issue | Severity | Recommendation |
|-------|----------|----------------|
| No \`worker_connections\` tuning | 🔴 High | Set \`worker_connections 4096;\` in nginx.conf |
| No \`upstream keepalive\` | 🔴 High | Add \`keepalive 64;\` to upstream block |
| \`proxy_read_timeout 60s\` | 🟡 Medium | Reduce to 15s for API endpoints |
| No \`proxy_buffering\` tuning | 🟡 Medium | Enable with \`proxy_buffer_size 8k;\` |

### PostgreSQL
| Issue | Severity | Recommendation |
|-------|----------|----------------|
| Default \`max_connections=100\` | 🔴 High | Increase to 200 or use PgBouncer |
| No connection pool tuning | 🔴 High | Set \`connection_limit=20\` in Prisma schema |
| Transaction aggregation locks | 🟡 Medium | Use \`REPEATABLE READ\` isolation for calculate |
| No \`statement_timeout\` | 🟡 Medium | Set 30s timeout to prevent runaway queries |

### Redis / BullMQ
| Issue | Severity | Recommendation |
|-------|----------|----------------|
| Worker concurrency = 5 | 🟡 Medium | Increase to 10–20 for burst processing |
| No Redis \`maxmemory\` policy | 🟡 Medium | Set \`maxmemory 256mb\` + \`allkeys-lru\` |
| Per-job DB read | 🟡 Medium | Batch user lookups or cache in Redis |

### Rate Limiting
| Issue | Severity | Recommendation |
|-------|----------|----------------|
| 100 req/15min global | 🔴 High | Will block legitimate "last day" traffic |
| No per-endpoint limits | 🟡 Medium | Add higher limits for dashboard endpoints |
| No burst allowance | 🟡 Medium | Allow short bursts above sustained rate |

---

## Recommendations (Priority Order)

1. **🔴 CRITICAL: Increase Nginx \`worker_connections\`** to 4096 and add upstream keepalive
2. **🔴 CRITICAL: Add PgBouncer** or increase PostgreSQL \`max_connections\` to 200+
3. **🔴 CRITICAL: Raise rate limits** for dashboard endpoints during deadline periods
4. **🟡 IMPORTANT: Increase BullMQ worker concurrency** to 10–20
5. **🟡 IMPORTANT: Set Prisma \`connection_limit=20\`** in datasource configuration
6. **🟡 IMPORTANT: Add Redis \`maxmemory 256mb\` with \`allkeys-lru\` eviction**
7. **🟢 NICE-TO-HAVE: Add response caching** for dashboard endpoints (30s TTL)
8. **🟢 NICE-TO-HAVE: Implement request coalescing** for duplicate declaration calculations

---

## Raw Output Files

- Dashboard: \`stress-test-results/dashboard_output_${TIMESTAMP}.txt\`
- Declarations: \`stress-test-results/declarations_output_${TIMESTAMP}.txt\`
- Notifications: \`stress-test-results/notifications_output_${TIMESTAMP}.txt\`
- JSON summaries: \`stress-test-results/*_${TIMESTAMP}.json\`

---

*Generated by NalogAI Last Day Deadline Stress Test Orchestrator*
HEREDOC

echo -e "${GREEN}[Report] Scalability Heatmap saved to: ${REPORT_FILE}${NC}"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Stress Test Complete${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Dashboard:    $([ $DASHBOARD_EXIT -eq 0 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo -e "  Declarations: $([ $DECLARATIONS_EXIT -eq 0 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo -e "  Notifications:$([ $NOTIFICATIONS_EXIT -eq 0 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo ""
echo -e "  Report: ${REPORT_FILE}"
echo ""

# Exit with failure if any scenario failed
if [ $DASHBOARD_EXIT -ne 0 ] || [ $DECLARATIONS_EXIT -ne 0 ] || [ $NOTIFICATIONS_EXIT -ne 0 ]; then
  exit 1
fi
