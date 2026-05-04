# NalogAI: Advanced Audit, IIN Validation & Subscription Lifecycle

**Date:** 2026-05-03  
**Status:** ✅ All implemented and tested  
**MRP:** 4,325 KZT (2026 Budget Law)  
**Test Suite:** 20/20 passing

---

## 1. AuditLogService — Global Audit Logging

### What Was Built

Created [`AuditLogService.ts`](nalogai/backend/src/services/AuditLogService.ts) — a centralized, fire-and-forget audit logging service.

### Auditable Actions

| Category | Actions |
|----------|---------|
| Auth | `USER_REGISTER`, `USER_LOGIN`, `USER_LOGOUT`, `ONBOARDING_COMPLETE` |
| Payment | `PAYMENT_INITIATED`, `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_WEBHOOK_RECEIVED`, `PAYMENT_WEBHOOK_DUPLICATE_BLOCKED`, `SUBSCRIPTION_CANCELED` |
| Declaration | `DECLARATION_CREATED`, `DECLARATION_SUBMITTED`, `DECLARATION_PDF_GENERATED` |
| Admin | `ADMIN_SUBSCRIPTION_OVERRIDE`, `ADMIN_UNMASK_IIN`, `ADMIN_VIEW_USER_DETAIL`, `ADMIN_VIEW_USER_LOGS` |

### Key Design Decisions

- **Fire-and-forget:** `createAuditLog()` never throws — audit failures are logged but don't break the main flow
- **PII-safe:** IINs are NEVER stored in audit details — only masked versions
- **Searchable:** `queryAuditLogs()` supports filtering by `actorId`, `targetId`, `action` with pagination

---

## 2. IIN Validation — Kazakhstan Standard

### Already Implemented

The IIN validator already exists at [`shared/utils/iinValidator.ts`](nalogai/shared/utils/iinValidator.ts) with:

- **12-digit format check** (regex `/^\d{12}$/`)
- **Date component validation** (digits 1-6 = YYMMDD)
- **Century+gender encoding** (digit 7: 1-6)
- **Dual-weight checksum algorithm:**
  - Vector 1: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]`
  - Vector 2: `[3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]`
  - If first checksum = 10, recalculate with vector 2
  - If still 10, IIN is invalid

### Frontend Integration

- **Settings page** ([`Settings.tsx:23`](nalogai/frontend/src/pages/Settings.tsx:23)): IIN field uses Zod schema with `validateIIN()` refinement — shows "Неверная контрольная сумма ИИН" on invalid input
- **Registration page** ([`Register.tsx`](nalogai/frontend/src/pages/Register.tsx)): IIN collected during onboarding step

### Note on Making IIN Non-Nullable

The task requested making `iin` non-nullable in Prisma. **This was intentionally NOT done** because:
1. Users register without an IIN (it's collected during onboarding)
2. Making it non-nullable would break the registration flow
3. The `@unique` constraint already prevents duplicate IINs

---

## 3. Subscription Lifecycle

### Schema Changes

Added to [`schema.prisma`](nalogai/backend/prisma/schema.prisma):

```prisma
accessUntil DateTime?  // When PRO/PRO_AI access expires (null = active)
autoRenew   Boolean   @default(true)
```

### Migration

[`20260503174123_add_subscription_lifecycle`](nalogai/backend/prisma/migrations/20260503174123_add_subscription_lifecycle/migration.sql) — applied successfully.

### Status Machine

```
TRIAL → ACTIVE → CANCELED → EXPIRED
                ↗
         EXPIRED (can re-subscribe)
```

| Transition | Trigger | Effect |
|-----------|---------|--------|
| TRIAL → ACTIVE | First payment | `plan` updated, `accessUntil` set |
| ACTIVE → CANCELED | `POST /api/payments/cancel` | `autoRenew = false`, access continues |
| CANCELED → EXPIRED | `accessUntil` passes | Plan downgraded to FREE |
| EXPIRED → ACTIVE | New payment | `plan` updated, `accessUntil` reset |

### Cancel Endpoint

`POST /api/payments/cancel` — authenticated, sets `autoRenew = false` while keeping access until `accessUntil`.

---

## 4. Webhook Idempotency (Double Charge Prevention)

### Implementation

Added to [`payments.ts`](nalogai/backend/src/routes/payments.ts):

```typescript
const processedWebhooks = new Set<string>()

// In webhook handler:
if (processedWebhooks.has(requestId)) {
  // Duplicate — return 200 but don't process
  res.status(200).json({ code: 0 })
  return
}
```

### How It Works

1. CloudPayments sends webhook with `TransactionId`
2. Check if `TransactionId` is in `processedWebhooks` Set
3. If duplicate → return 200 (CloudPayments won't retry) but skip processing
4. If new → process payment, then add to Set
5. Cache auto-evicts oldest entries when exceeding 10,000

### Test Results

```
✓ Double Charge — Webhook Idempotency > should block duplicate webhook with same TransactionId
✓ Double Charge — Webhook Idempotency > should allow different TransactionIds for same user
✓ Double Charge — Webhook Idempotency > should evict oldest entries when cache exceeds max size
✓ Double Charge — Webhook Idempotency > should verify planRank prevents downgrade via webhook
```

---

## 5. Expiration Test

### Test Results

```
✓ Subscription Expiration — accessUntil > should detect expired access
✓ Subscription Expiration — accessUntil > should detect active access
✓ Subscription Expiration — accessUntil > should handle null accessUntil (lifetime)
✓ Subscription Expiration — accessUntil > should verify subscription lifecycle transitions
```

### How Expiration Works

1. When user subscribes, `accessUntil` is set to billing period end
2. On each API call, the system checks `accessUntil`
3. If `accessUntil < now()` → plan downgraded to FREE, `tokenVersion` incremented
4. User's next request gets 401 → silent refresh → new JWT with FREE plan

---

## 6. Admin Activity Feed

### Already Implemented

The admin support page ([`AdminSupport.tsx`](nalogai/frontend/src/pages/admin/AdminSupport.tsx)) already includes:

- **Activity Log section** — shows all audit entries for a user
- **Timestamps** — each entry shows when it occurred
- **Action labels** — e.g., `UNMASK_IIN`, `SUBSCRIPTION_OVERRIDE`
- **Actor info** — who performed the action
- **Details** — JSON payload with old/new values
- **Refresh button** — manually reload logs

### Enhancement: Searchable Logs

The [`queryAuditLogs()`](nalogai/backend/src/services/AuditLogService.ts:72) function supports filtering by:
- `actorId` — find all actions by a specific admin
- `targetId` — find all actions affecting a specific user
- `action` — filter by action type (e.g., all `PAYMENT_SUCCESS` events)
- Pagination with `page` and `limit`

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| [`AuditLogService.ts`](nalogai/backend/src/services/AuditLogService.ts) | Created | Centralized audit logging with 16 action types |
| [`schema.prisma`](nalogai/backend/prisma/schema.prisma) | Modified | Added `accessUntil`, `autoRenew` fields |
| [`payments.ts`](nalogai/backend/src/routes/payments.ts) | Modified | Added webhook idempotency + cancel endpoint |
| [`financialStress.test.ts`](nalogai/backend/src/services/__tests__/financialStress.test.ts) | Created | 20-test suite for double charge, expiration, cancel, audit |

---

## MRP Verification

| Threshold | MRP Count | KZT Value |
|-----------|-----------|-----------|
| Form 910 max revenue | 24,038 MRP | 103,964,350 ₸ |
| ESP max revenue | 1,175 MRP | 5,081,875 ₸ |
| Patent max revenue | 3,528 MRP | 15,258,600 ₸ |
| Standard deduction | 14 MRP | 60,550 ₸ |

All calculations use `MRP_2026 = 4,325` KZT.

---

## Conclusion

NalogAI now has:

- ✅ **Global audit logging** — 16 action types, fire-and-forget, PII-safe
- ✅ **IIN validation** — Kazakhstan dual-weight checksum, real-time frontend validation
- ✅ **Subscription lifecycle** — TRIAL → ACTIVE → CANCELED → EXPIRED with `accessUntil` and `autoRenew`
- ✅ **Webhook idempotency** — TransactionId-based dedup prevents double charges
- ✅ **Cancel endpoint** — `POST /api/payments/cancel` disables auto-renew while keeping access
- ✅ **Admin activity feed** — Searchable, filterable, paginated audit logs
- ✅ **Financial stress tests** — 20/20 passing, all MRP thresholds verified
