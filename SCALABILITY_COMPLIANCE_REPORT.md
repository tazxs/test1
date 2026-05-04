# NalogAI: Scalability & Compliance Complete

**Date:** 2026-05-01
**Status:** ✅ All tasks completed

---

## Executive Summary

This report confirms the successful implementation of database performance optimizations, data safety measures, legal compliance features, and security hardening for the NalogAI platform. All changes are production-ready and comply with Kazakhstan regulatory requirements.

---

## 1. Database Performance & Safety ✅

### 1.1 Indexing Strategy

**New indexes added** to [`schema.prisma`](nalogai/backend/prisma/schema.prisma) via migration [`20260501133500_add_performance_indexes_and_check_constraints`](nalogai/backend/prisma/migrations/20260501133500_add_performance_indexes_and_check_constraints/migration.sql):

| Table | Index | Justification |
|-------|-------|---------------|
| `transactions` | `(userId, source)` | Bank sync dedup queries — filters by user + bank provider |
| `transactions` | `(source, createdAt)` | Cleanup job: find bank-imported transactions by age |
| `declarations` | `(userId, formType)` | Filter declarations by form type (910/200/912/ESP) |
| `declarations` | `(status, createdAt)` | ISNA poll job: find SUBMITTED declarations for status checks |

**Pre-existing indexes** (already in schema):
- `transactions`: `(userId, date DESC)`, `(userId, type)`, `(userId, category)`, `(userId, deletedAt)`, `(userId, externalId) UNIQUE`
- `declarations`: `(userId, status)`, `(userId, deletedAt)`, `(userId, period, formType) UNIQUE`

### 1.2 Soft Deletes — Verified Working

Soft deletes were **already implemented** in the codebase:
- Schema: `deletedAt DateTime?` on both `Transaction` and `Declaration` models
- Routes: All queries filter by `deletedAt: null`
- DELETE endpoint: Sets `deletedAt = new Date()` instead of hard-deleting

**QA verification** (new test: [`softDelete.test.ts`](nalogai/backend/src/routes/__tests__/softDelete.test.ts)):
- ✅ Soft-deleted transactions excluded from list queries
- ✅ Records remain in database with `deletedAt` set
- ✅ 404 returned when trying to delete already-deleted records
- ✅ Same behavior verified for declarations

### 1.3 Data Integrity — DB-Level CHECK Constraint

**Migration SQL:**
```sql
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_non_negative" CHECK ("amount" >= 0);
```

**QA verification** (in [`softDelete.test.ts`](nalogai/backend/src/routes/__tests__/softDelete.test.ts)):
- ✅ Negative amounts rejected at database level (Prisma throws)
- ✅ Zero amounts accepted
- ✅ Application-level validation also present in [`TaxCalculatorService.ts`](nalogai/backend/src/services/TaxCalculatorService.ts:54)

---

## 2. Legal UI & Security ✅

### 2.1 Legal Pages

| Page | Route | File |
|------|-------|------|
| Terms of Service | `/terms` | [`TermsOfService.tsx`](nalogai/frontend/src/pages/TermsOfService.tsx) |
| Privacy Policy | `/privacy` | [`PrivacyPolicy.tsx`](nalogai/frontend/src/pages/PrivacyPolicy.tsx) |

**Compliance with RK Law "On Personal Data and their Protection" (No. 94-V):**
- ✅ Explicit mention that data is stored on servers in Kazakhstan
- ✅ Data retention periods specified (5 years for tax records per НК РК)
- ✅ User rights enumerated (access, correction, deletion, consent withdrawal)
- ✅ Contact information for data protection inquiries
- ✅ Legal basis for processing documented

### 2.2 Onboarding Consent Checkbox

**File:** [`Register.tsx`](nalogai/frontend/src/pages/Register.tsx)

- ✅ Mandatory checkbox: "Я даю согласие на сбор и обработку персональных данных"
- ✅ Links to `/privacy` and `/terms` (open in new tab)
- ✅ Zod validation: `z.literal(true)` — form cannot submit without consent
- ✅ Error message displayed if unchecked

**QA verification** (new test: [`Register.consent.test.tsx`](nalogai/frontend/src/pages/__tests__/Register.consent.test.tsx)):
- ✅ Checkbox rendered and unchecked by default
- ✅ Links point to correct routes with `target="_blank"`
- ✅ Submit button present

### 2.3 Content Security Policy (CSP)

**File:** [`app.ts`](nalogai/backend/src/app.ts)

Strict CSP configured via `helmet()`:

| Directive | Allowed Sources | Rationale |
|-----------|----------------|-----------|
| `default-src` | `'self'` | Block everything by default |
| `script-src` | `'self'`, Sentry CDN | No `'unsafe-inline'` — blocks inline XSS |
| `style-src` | `'self'`, `'unsafe-inline'`, Google Fonts | TailwindCSS requires unsafe-inline |
| `font-src` | `'self'`, Google Fonts, `data:` | Only trusted font sources |
| `connect-src` | `'self'`, Sentry, Groq, Gemini, CORS origin | Only our API and AI providers |
| `frame-src` | `'none'` | No iframes allowed |
| `object-src` | `'none'` | No plugins/embeds |

**QA verification** (new test: [`csp.test.ts`](nalogai/backend/src/routes/__tests__/csp.test.ts)):
- ✅ CSP header present on all responses
- ✅ `default-src 'self'` enforced
- ✅ No `'unsafe-inline'` in `script-src`
- ✅ `frame-src 'none'` and `object-src 'none'`
- ✅ Trusted domains whitelisted in `connect-src`
- ✅ Google Fonts allowed in `style-src` and `font-src`
- ✅ Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`

---

## 3. DevOps & Infrastructure ✅

### 3.1 Automated Database Backups

**Files:**
- [`backup-db.sh`](nalogai/backend/scripts/backup-db.sh) — Standalone backup script
- [`docker-compose.prod.yml`](nalogai/docker-compose.prod.yml) — Docker-based daily backup service

**Configuration:**
- Schedule: Daily at 02:00 (via cron in Docker container)
- Retention: Configurable via `BACKUP_RETAIN_DAYS` (default: 30 days)
- Format: gzip-compressed SQL dumps
- Integrity: Automatic `gzip -t` verification after each backup
- Storage: Dedicated `postgres_backups` Docker volume

**First successful backup:** Confirmed via script execution (see backup script output).

### 3.2 Soft-Delete Cleanup Job

**File:** [`softDeleteCleanup.ts`](nalogai/backend/src/jobs/softDeleteCleanup.ts)

- Schedule: 1st of every month at 03:00 Asia/Almaty
- Retention: 5 years (per Kazakhstan tax record retention law)
- Batch size: 500 records per DELETE to avoid long transactions
- Tables: `transactions` and `declarations`
- Registered in [`index.ts`](nalogai/backend/src/index.ts:63)

### 3.3 Performance Profiling

**File:** [`k6-transactions-load-test.js`](nalogai/backend/scripts/k6-transactions-load-test.js)

- Tool: k6 load testing framework
- Target: `/api/transactions` endpoint
- Thresholds: p95 < 100ms, p99 < 200ms, error rate < 1%
- Stages: Ramp 10→50 VUs over 3.5 minutes
- Run: `k6 run scripts/k6-transactions-load-test.js`

---

## 4. Files Modified/Created Summary

### Modified Files
| File | Changes |
|------|---------|
| [`schema.prisma`](nalogai/backend/prisma/schema.prisma) | +4 performance indexes |
| [`app.ts`](nalogai/backend/src/app.ts) | Strict CSP via helmet configuration |
| [`index.ts`](nalogai/backend/src/index.ts) | Registered soft-delete cleanup job |
| [`constants.ts`](nalogai/frontend/src/lib/constants.ts) | Added `/terms` and `/privacy` routes |
| [`App.tsx`](nalogai/frontend/src/App.tsx) | Added lazy-loaded legal page routes |
| [`Register.tsx`](nalogai/frontend/src/pages/Register.tsx) | Added privacy consent checkbox + Zod validation |
| [`docker-compose.prod.yml`](nalogai/docker-compose.prod.yml) | Added `db-backup` service |
| [`.env.example`](nalogai/.env.example) | Added `BACKUP_RETAIN_DAYS` |

### New Files
| File | Purpose |
|------|---------|
| [`migration.sql`](nalogai/backend/prisma/migrations/20260501133500_add_performance_indexes_and_check_constraints/migration.sql) | Index + CHECK constraint migration |
| [`TermsOfService.tsx`](nalogai/frontend/src/pages/TermsOfService.tsx) | Terms of Service page (RK compliant) |
| [`PrivacyPolicy.tsx`](nalogai/frontend/src/pages/PrivacyPolicy.tsx) | Privacy Policy page (RK Law No. 94-V) |
| [`backup-db.sh`](nalogai/backend/scripts/backup-db.sh) | Automated PostgreSQL backup script |
| [`softDeleteCleanup.ts`](nalogai/backend/src/jobs/softDeleteCleanup.ts) | Monthly cleanup of 5-year-old soft-deleted records |
| [`k6-transactions-load-test.js`](nalogai/backend/scripts/k6-transactions-load-test.js) | k6 load test for transactions endpoint |
| [`softDelete.test.ts`](nalogai/backend/src/routes/__tests__/softDelete.test.ts) | Integration tests for soft deletes + CHECK constraint |
| [`csp.test.ts`](nalogai/backend/src/routes/__tests__/csp.test.ts) | CSP header audit tests |
| [`Register.consent.test.tsx`](nalogai/frontend/src/pages/__tests__/Register.consent.test.tsx) | Consent checkbox UI tests |

---

## 5. Compliance Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Indexes on frequently queried fields | ✅ | Schema + migration |
| Soft deletes for Transactions & Declarations | ✅ | Schema + routes + tests |
| DB-level non-negative amount constraint | ✅ | Migration CHECK constraint |
| Terms of Service page | ✅ | `/terms` route |
| Privacy Policy (RK Law compliant) | ✅ | `/privacy` route |
| Mandatory consent checkbox on registration | ✅ | Register.tsx + Zod validation |
| Strict CSP headers | ✅ | helmet config + tests |
| Daily automated DB backups | ✅ | Docker service + script |
| 5-year retention cleanup job | ✅ | Cron job registered |
| Performance load test | ✅ | k6 script ready |
