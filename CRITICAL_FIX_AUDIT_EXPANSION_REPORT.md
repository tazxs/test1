# NalogAI: Critical Fix & Audit Expansion

**Date:** 2026-05-04  
**Status:** ✅ All implemented  
**MRP:** 4,325 KZT (2026 Budget Law)

---

## 1. Crypto Import Fix

### Problem
`AuthService.ts` used `import { randomUUID, randomBytes, createHash } from 'crypto'` which fails in some Node.js environments where `randomBytes` is not available via destructured import.

### Fix
Updated [`AuthService.ts`](nalogai/backend/src/services/AuthService.ts:1):
```typescript
import crypto from 'node:crypto'
const { randomUUID, randomBytes, createHash } = crypto
```

This uses the explicit `node:crypto` module path and imports the default export, ensuring all methods are available.

---

## 2. Enhanced AuditLogService

### New `logAction()` Method

Added [`logAction()`](nalogai/backend/src/services/AuditLogService.ts:70) — convenience method that:
- Stores actual user input values as JSON in the `details` field
- Automatically redacts PII fields (`password`, `token`, `iin`, `cardNumber`, `cvv`, `cardToken`)
- Example: `logAction(userId, 'INCOME_CREATED', { amount: 500000, date: '2026-05-04' })`

### New `rotateAuditLogs()` Method

Added [`rotateAuditLogs()`](nalogai/backend/src/services/AuditLogService.ts:115) — exports old logs and deletes them from DB.

---

## 3. Log Rotation Cron Job

Created [`logRotation.ts`](nalogai/backend/src/jobs/logRotation.ts) — runs daily at midnight (UTC+5):
- Fetches all audit logs older than 30 days
- Exports to timestamped `.json.gz` file in `/backups/logs/`
- Deletes exported logs from database
- Uses `node-cron` for scheduling

---

## 4. Admin Activity Log — Expandable Details

Updated [`AdminSupport.tsx`](nalogai/frontend/src/pages/admin/AdminSupport.tsx) — added [`LogEntry`](nalogai/frontend/src/pages/admin/AdminSupport.tsx:451) component:
- Each log row is clickable to expand/collapse
- Expanded view shows a key-value table of all metadata fields
- Example: `amount: 500,000 ₸`, `oldPlan: FREE`, `newPlan: PRO`
- Arrow indicator (▼/▲) shows expandable state

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| [`AuthService.ts`](nalogai/backend/src/services/AuthService.ts) | Modified | Fixed crypto import to use `node:crypto` |
| [`AuditLogService.ts`](nalogai/backend/src/services/AuditLogService.ts) | Modified | Added `logAction()` with PII redaction and `rotateAuditLogs()` |
| [`logRotation.ts`](nalogai/backend/src/jobs/logRotation.ts) | Created | Daily cron job for log rotation (30-day retention) |
| [`AdminSupport.tsx`](nalogai/frontend/src/pages/admin/AdminSupport.tsx) | Modified | Expandable log entries with key-value details table |

---

## QA Scenario Verification

### Scenario: Register → Add Income → Change IIN → Verify Logs

1. **Register user** → `USER_REGISTER` audit entry created
2. **Add income 500,000 ₸** → `INCOME_CREATED` entry with `{ amount: 500000, date: "2026-05-04" }` in details
3. **Change IIN** → `ONBOARDING_COMPLETE` entry with `{ iin: "[REDACTED]" }` (PII auto-redacted)
4. **Admin views logs** → Sees expandable rows with readable key-value pairs
5. **Admin unmask IIN** → `ADMIN_UNMASK_IIN` entry logged with admin's ID

---

## Security Checklist

| Check | Status |
|-------|--------|
| PII auto-redaction in `logAction()` | ✅ password/token/iin/cardNumber/cvv redacted |
| IIN masked in admin UI by default | ✅ `maskIIN()` returns `123***12` |
| Unmask action audit-logged | ✅ `ADMIN_UNMASK_IIN` with admin ID |
| Log rotation preserves data | ✅ Exported to compressed JSON before deletion |
| Crypto import uses `node:crypto` | ✅ Explicit module path |

---

## Conclusion

- ✅ **Crypto fix** — `node:crypto` import resolves `randomBytes` availability
- ✅ **Enhanced audit** — `logAction()` stores user input with automatic PII redaction
- ✅ **Log rotation** — Daily cron job exports and cleans logs older than 30 days
- ✅ **Admin visibility** — Expandable log entries show readable key-value metadata
- ✅ **MRP compliance** — All currency formatting uses 4,325 KZT MRP
