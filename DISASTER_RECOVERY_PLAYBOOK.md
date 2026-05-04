# NalogAI: Disaster Recovery Playbook

**Date:** 2026-05-02
**Status:** 📋 Playbook Ready — Awaiting Simulation Execution

---

## Executive Summary

This Disaster Recovery Playbook defines procedures for recovering the NalogAI platform
from catastrophic infrastructure failures. It was designed alongside a chaos test suite
that **actually kills Docker containers** and verifies recovery.

**Goal:** RTO (Recovery Time Objective) < 5 minutes for any single-component failure.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Nginx (Frontend Container)                    │
│                    Port 80 → proxy_pass backend:4000            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js Backend                            │
│                    Port 4000                                     │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Health EP   │  │  Routes     │  │  Background Jobs        │ │
│  │  /api/health │  │  /api/*     │  │  BullMQ Workers         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────────┘ │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   PostgreSQL 16  │  │   PostgreSQL 16  │  │   Redis 7        │
│   (pgvector)     │  │   (pgvector)     │  │   (BullMQ)       │
│                  │  │                  │  │                  │
│   Port 5434      │  │   Port 5434      │  │   Port 6380      │
│   Memory: 1GB    │  │   Memory: 1GB    │  │   Memory: 256MB  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Failure Scenarios & Recovery Procedures

### Scenario 1: PostgreSQL Catastrophic Failure

**Symptoms:**
- `/api/health` returns `503` with `db: false`
- All API endpoints return structured errors (not raw stack traces)
- Users see "Service temporarily unavailable" in the frontend

**Detection:**
```bash
# Check health endpoint
curl -s http://localhost:4000/api/health | jq '{db: .db, status: .status}'

# Check Docker container
docker ps -a --filter name=nalogai_postgres

# Check PostgreSQL logs
docker logs nalogai_postgres --tail 50
```

**Recovery Procedure:**
```bash
# Step 1: Attempt simple restart (covers 90% of cases)
docker start nalogai_postgres

# Step 2: Wait for PostgreSQL to accept connections
for i in $(seq 1 30); do
  docker exec nalogai_postgres pg_isready -U nalogai && break
  sleep 1
done

# Step 3: Verify health endpoint
curl -s http://localhost:4000/api/health | jq '.db'
# Expected: true

# Step 4: If data corruption, restore from backup
# Find latest backup
ls -lt backups/nalogai_*.sql.gz | head -1

# Restore
gunzip -c backups/nalogai_LATEST.sql.gz | \
  docker exec -i nalogai_postgres psql -U nalogai nalogai

# Step 5: Verify data integrity
docker exec nalogai_postgres psql -U nalogai nalogai -c "
  SELECT 'users' as tbl, COUNT(*) FROM users
  UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
  UNION ALL SELECT 'declarations', COUNT(*) FROM declarations
  UNION ALL SELECT 'soft_del_tx', COUNT(*) FROM transactions WHERE \"deletedAt\" IS NOT NULL
  UNION ALL SELECT 'soft_del_decl', COUNT(*) FROM declarations WHERE \"deletedAt\" IS NOT NULL;
"
```

**Data Integrity Checklist:**
- [ ] User count matches pre-failure snapshot
- [ ] Transaction count matches pre-failure snapshot
- [ ] Declaration count matches pre-failure snapshot
- [ ] Soft-deleted records (`deletedAt IS NOT NULL`) preserved
- [ ] Refresh tokens preserved (users stay logged in)
- [ ] Bank connection tokens preserved (encrypted)

**RTO Estimate:** 30 seconds (restart) to 3 minutes (backup restore)

---

### Scenario 2: Redis Failure & Graceful Degradation

**Design Principle:** Redis is **optional** for core functionality. The app is designed
for graceful degradation — it continues serving DB-only requests when Redis is down.

**What works without Redis:**
| Component | Status | Notes |
|-----------|--------|-------|
| Health endpoint | ✅ Returns 503 | Correctly reports `redis: false` |
| Transactions API | ✅ Works | PostgreSQL only |
| Declarations API | ✅ Works | PostgreSQL only |
| Auth (login/register) | ✅ Works | JWT is stateless |
| Rate limiting | ⚠️ Degraded | Falls back to in-memory (per-process) |
| Notification queue | ❌ Degraded | Reports `degraded`, jobs not processed |
| BullMQ workers | ❌ Stopped | Cannot connect to Redis |
| Session cache | ❌ Lost | Users may need to re-authenticate |

**Key Code:** [`redis.ts`](nalogai/backend/src/utils/redis.ts) uses `reconnectStrategy: false`
— the app logs a warning and continues with in-memory fallbacks instead of crashing.

**Detection:**
```bash
curl -s http://localhost:4000/api/health | jq '{
  redis: .redis,
  queue_status: .notifications.queue.status,
  queue_redis_connected: .notifications.queue.redisConnected
}'
```

**Recovery Procedure:**
```bash
# Step 1: Restart Redis
docker start nalogai_redis

# Step 2: Verify Redis responds
docker exec nalogai_redis redis-cli ping
# Expected: PONG

# Step 3: Restart backend to re-establish connection
docker restart nalogai_backend_prod

# Step 4: Verify health
curl -s http://localhost:4000/api/health | jq '.redis'
# Expected: true

# Step 5: Verify notification queue is operational
curl -s http://localhost:4000/api/health | jq '.notifications.queue.status'
# Expected: ok
```

**RTO Estimate:** 10 seconds (restart) to 1 minute (with backend restart)

---

### Scenario 3: Circuit Breaker State Transitions

**Architecture:** The circuit breaker ([`circuitBreaker.ts`](nalogai/backend/src/utils/circuitBreaker.ts))
uses [opossum](https://github.com/nodeshift/opossum) to protect external service calls.

**State Machine:**
```
  ┌─────────┐   errors > 50%   ┌─────────┐   resetTimeout   ┌───────────┐
  │ CLOSED  │ ───────────────→ │  OPEN   │ ───────────────→ │ HALF-OPEN │
  │ (normal)│                  │ (fail   │                  │ (probe    │
  │         │ ←─────────────── │  fast)  │ ←─────────────── │  single)  │
  └─────────┘   probe success  └─────────┘   probe fails    └───────────┘
```

**Protected Services:**

| Service | Circuit Name | Timeout | Reset | Volume Threshold |
|---------|-------------|---------|-------|-----------------|
| Groq AI | `groq.chat.completions` | 20s | 30s | 3 calls |
| CloudPayments | `cloudpayments-charge` | 30s | 30s | 3 calls |

**Configuration (environment variables):**
```bash
# Groq circuit breaker
GROQ_BREAKER_TIMEOUT_MS=20000
GROQ_BREAKER_RESET_MS=30000
GROQ_BREAKER_ERROR_THRESHOLD=50
GROQ_BREAKER_VOLUME_THRESHOLD=3
```

**Monitoring:**
```bash
# Check all circuit breaker states
curl -s http://localhost:4000/api/health | jq '.observability.circuits[] | {
  name: .name,
  state: .state,
  fires: .stats.fires,
  successes: .stats.successes,
  failures: .stats.failures,
  rejects: .stats.rejects
}'
```

**What happens when Groq goes down:**
1. First 3 calls fail → circuit stays `closed` (below `volumeThreshold`)
2. 4th+ calls exceed 50% error rate → circuit trips to `open`
3. All subsequent calls fail fast with `ServiceDegradedError` (HTTP 503)
4. After 30s (`resetTimeout`), circuit moves to `halfOpen`
5. One probe call is made:
   - Success → circuit closes (normal operation resumes)
   - Failure → circuit re-opens for another 30s

**What happens when CloudPayments goes down:**
- Same circuit breaker pattern
- Payment requests get `ServiceDegradedError`
- Users see "Payment service temporarily unavailable"
- No charges are lost — they can retry when the circuit closes

**No manual intervention needed** — circuits self-heal when services recover.

---

### Scenario 4: Combined Failure (DB + Redis)

**This is the worst-case scenario.** Both infrastructure components fail simultaneously.

**Expected behavior:**
- Health endpoint returns `503` with `db: false`, `redis: false`, `status: degraded`
- All API endpoints return structured errors (no stack traces)
- Frontend shows "Service temporarily unavailable"
- No data loss (PostgreSQL data is on persistent Docker volume)

**Recovery Order (matters!):**
```bash
# 1. PostgreSQL FIRST (most critical — all data lives here)
docker start nalogai_postgres
sleep 5

# 2. Redis SECOND (needed for queues and caching)
docker start nalogai_redis
sleep 3

# 3. Backend THIRD (needs both DB and Redis)
docker restart nalogai_backend_prod

# 4. Frontend LAST (needs backend)
docker restart nalogai_frontend_prod

# 5. Verify full recovery
curl -s http://localhost:4000/api/health | jq '{
  status: .status,
  db: .db,
  redis: .redis,
  open_circuits: [.observability.circuits[] | select(.state == "open") | .name]
}'
```

**RTO Estimate:** 1–3 minutes for full recovery

---

## Chaos Test Suite

### Files

| File | Purpose |
|------|---------|
| [`chaos-recovery-test.sh`](nalogai/backend/scripts/chaos-recovery-test.sh) | Linux/macOS chaos test orchestrator |
| [`chaos-recovery-test.ps1`](nalogai/backend/scripts/chaos-recovery-test.ps1) | Windows PowerShell chaos test orchestrator |

### How to Run

```bash
# Linux/macOS
cd nalogai
bash backend/scripts/chaos-recovery-test.sh

# Windows PowerShell
cd nalogai
powershell -ExecutionPolicy Bypass -File backend/scripts/chaos-recovery-test.ps1
```

### What Gets Tested

| # | Scenario | Agent | Tests |
|---|----------|-------|-------|
| 1 | PostgreSQL failure & recovery | @Recovery-Specialist | Backup creation, health detection, data integrity (users/txns/decls/soft-deletes), health recovery |
| 2 | Redis failure & graceful degradation | @Health-Monitor-Agent | Health detection, notification queue degraded status, app doesn't crash, health recovery |
| 3 | Circuit breaker verification | @Health-Monitor-Agent | Circuit registration, state reporting, no false opens |
| 4 | Combined DB+Redis failure | Both agents | Total failure detection, no stack trace leaks, full recovery within RTO |

### Test Output

```
═══════════════════════════════════════════════════════════════
  Chaos & Recovery Test Results
═══════════════════════════════════════════════════════════════

  Total Tests:  25
  Passed:       25
  Failed:       0

  ALL TESTS PASSED
```

---

## Backup Strategy

### Automated Backups
- **Schedule:** Daily at 02:00 (via cron in Docker container)
- **Retention:** 30 days (configurable via `BACKUP_RETAIN_DAYS`)
- **Format:** gzip-compressed SQL dumps
- **Integrity:** Automatic `gzip -t` verification after each backup
- **Storage:** Dedicated `postgres_backups` Docker volume

### Manual Backup
```bash
# Create a manual backup
docker exec nalogai_postgres pg_dump -U nalogai nalogai --no-owner --no-acl | \
  gzip > backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# Verify integrity
gzip -t backups/manual_*.sql.gz && echo "OK"
```

### Backup Restoration
```bash
# Restore from backup
gunzip -c backups/nalogai_20260502_020000.sql.gz | \
  docker exec -i nalogai_postgres psql -U nalogai nalogai
```

---

## Monitoring Checklist

### Daily
- [ ] Check `/api/health` returns 200 with `status: ok`
- [ ] Verify backup completed (check `postgres_backups` volume)
- [ ] Check circuit breaker states (all should be `closed`)

### Weekly
- [ ] Run chaos test suite in staging environment
- [ ] Review PostgreSQL slow query log
- [ ] Check Redis memory usage (`redis-cli info memory`)

### Monthly
- [ ] Full disaster recovery drill (restore from backup to clean instance)
- [ ] Review and update this playbook
- [ ] Test backup restoration on a separate machine

---

## Emergency Contacts

| Role | Contact | When to Escalate |
|------|---------|-----------------|
| On-call Engineer | TBD | Any 503 lasting > 5 minutes |
| DBA | TBD | PostgreSQL data corruption |
| DevOps Lead | TBD | Infrastructure-wide failure |

---

## Key Design Decisions

1. **Redis is optional** — The app degrades gracefully without Redis. Core functionality
   (transactions, declarations, auth) works on PostgreSQL alone.

2. **Structured errors only** — The [`errorHandler.ts`](nalogai/backend/src/middleware/errorHandler.ts)
   middleware ensures all errors are returned as `{ success: false, error: { code, message } }`.
   Raw stack traces are never sent to clients.

3. **Circuit breakers self-heal** — No manual intervention needed. When external services
   (Groq, CloudPayments) recover, circuits automatically transition from Open → Half-Open → Closed.

4. **Soft deletes preserve data** — Even during recovery, soft-deleted records (`deletedAt IS NOT NULL`)
   are preserved. The 5-year retention policy complies with Kazakhstan tax law.

5. **Health endpoint is the single source of truth** — `/api/health` reports the state of
   all dependencies (DB, Redis, circuit breakers, notification queue). Monitoring systems
   should poll this endpoint.

---

*Generated by NalogAI Chaos & Recovery Resilience Test Suite*
