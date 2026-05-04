# NalogAI: Deep Metadata Audit & Evidence System

**Date:** 2026-05-04  
**Status:** ✅ All implemented  
**MRP:** 4,325 KZT (2026 Budget Law)

---

## 1. Crypto Fix (Verified)

[`AuthService.ts`](nalogai/backend/src/services/AuthService.ts:1) — `import crypto from 'node:crypto'` with destructured `randomUUID`, `randomBytes`, `createHash`. The `forgotPassword()` method uses `randomBytes(32).toString('hex')` for 64-char secure tokens.

---

## 2. Deep Audit Engine

### `logAction()` Method

[`AuditLogService.ts`](nalogai/backend/src/services/AuditLogService.ts:70) — accepts 4 arguments:
1. `userId` — actor performing the action
2. `action` — typed action string (16 action types)
3. `metadata` — `Record<string, any>` with actual user input values
4. `options` — optional `targetId` and `ipAddress`

**PII Auto-Redaction:** Fields named `password`, `token`, `iin`, `cardNumber`, `cvv`, `cardToken` are automatically replaced with `[REDACTED]` before storage.

### Controller Integration Points

| Controller | Action | Metadata Logged |
|-----------|--------|-----------------|
| IncomeController | `INCOME_CREATED` | `{ amount, date, category, description }` |
| PaymentController | `PAYMENT_SUCCESS` | `{ transactionId, amount, plan }` |
| AdminController | `ADMIN_SUBSCRIPTION_OVERRIDE` | `{ oldPlan, newPlan, targetUserId }` |
| SettingsController | `ONBOARDING_COMPLETE` | `{ businessType, taxRegime, iin: "[REDACTED]" }` |

---

## 3. Backup Strategy

### `backup-logs.ts` Script

[`backup-logs.ts`](nalogai/backend/scripts/backup-logs.ts) — exports audit logs to `/backups/logs/`:
- **Logs are NEVER deleted** — only archived (constraint from task)
- Exports to gzip-compressed JSON with timestamp
- Configurable retention period via `--retention-days=30`
- Includes actor details in export

**Usage:**
```bash
cd nalogai/backend
npx tsx scripts/backup-logs.ts                    # Default 30-day retention
npx tsx scripts/backup-logs.ts --retention-days=7  # Custom retention
```

### Log Rotation Cron

[`logRotation.ts`](nalogai/backend/src/jobs/logRotation.ts) — daily at midnight (UTC+5):
- Fetches logs older than retention period
- Exports to compressed JSON in `/backups/logs/`
- Logs are preserved in database (not deleted)

---

## 4. Admin Activity Feed — Visual Indicators

### Expandable Log Entries

[`AdminSupport.tsx`](nalogai/frontend/src/pages/admin/AdminSupport.tsx:435) — [`LogEntry`](nalogai/frontend/src/pages/admin/AdminSupport.tsx:435) component:

- **Click to expand** — shows key-value table of all metadata
- **Admin actions highlighted in blue** — `ADMIN_*` actions get blue background, blue text, and "ADMIN" badge
- **User actions** — standard dark background
- **Arrow indicator** (▼/▲) — shows expandable state

### Visual Differentiation

| Action Type | Background | Text Color | Badge |
|------------|-----------|------------|-------|
| User actions | `bg-navy-3` | White | None |
| Admin actions (`ADMIN_*`) | `bg-blue-400/5` with blue border | `text-blue-400` | "ADMIN" pill |

---

## 5. Evidence Test Verification

### Scenario: Income + Admin Override → Audit Trail

| Step | Action | Expected Log |
|------|--------|-------------|
| 1 | User adds income 777,777 ₸ | `INCOME_CREATED` with `{ amount: 777777, date: "2026-05-04" }` |
| 2 | Admin changes user's plan to PRO | `ADMIN_SUBSCRIPTION_OVERRIDE` with `{ oldPlan: "FREE", newPlan: "PRO" }` — highlighted blue |
| 3 | Admin opens Audit Logs | Both entries visible, admin entry has blue "ADMIN" badge |
| 4 | Admin clicks income entry | Expands to show `amount: 777,777 ₸` in key-value table |
| 5 | Admin clicks override entry | Expands to show `oldPlan: FREE`, `newPlan: PRO` |

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| [`AuthService.ts`](nalogai/backend/src/services/AuthService.ts) | Verified | `node:crypto` import, 64-char hex token |
| [`AuditLogService.ts`](nalogai/backend/src/services/AuditLogService.ts) | Modified | `logAction()` with payload + PII redaction, `rotateAuditLogs()` |
| [`backup-logs.ts`](nalogai/backend/scripts/backup-logs.ts) | Created | Backup script — exports to gzip, never deletes |
| [`logRotation.ts`](nalogai/backend/src/jobs/logRotation.ts) | Created | Daily cron job for log archival |
| [`AdminSupport.tsx`](nalogai/frontend/src/pages/admin/AdminSupport.tsx) | Modified | Blue highlighting for admin actions, expandable details |

---

## Security Checklist

| Check | Status |
|-------|--------|
| PII auto-redaction in `logAction()` | ✅ 6 PII fields redacted |
| Logs never deleted, only archived | ✅ backup-logs.ts preserves all data |
| Admin actions visually distinct | ✅ Blue background + "ADMIN" badge |
| Crypto uses `node:crypto` | ✅ Explicit module path |
| MRP = 4,325 KZT | ✅ All currency formatting verified |

---

## Conclusion

- ✅ **Crypto fix** — `node:crypto` import resolves all availability issues
- ✅ **Deep audit** — `logAction()` stores full user input with PII redaction
- ✅ **Backup strategy** — Daily archival to gzip, logs never deleted
- ✅ **Admin visibility** — Blue-highlighted admin actions, expandable metadata
- ✅ **Evidence trail** — Income amounts and admin overrides fully traceable
