# NalogAI: Full Transparency & Recovery Initialized

**Date:** 2026-05-04  
**Status:** ✅ All implemented  
**MRP:** 4,325 KZT (2026 Budget Law)

---

## 1. Admin Financial Deep Eye

### New Endpoint: `GET /api/admin/users/:id/finances`

Returns comprehensive financial data for a user:

| Field | Description |
|-------|-------------|
| `transactions` | All income/expense records for current year |
| `summary` | Total income, total expense, net income |
| `form910Progress` | Progress bar toward 103,964,350 ₸ threshold (24,038 × 4,325 MRP) |
| `taxObligations` | Real-time IPN (1.5%), Social Tax (1.5%), OPV (10%), OSMS |

### Admin UI: "Финансовая активность" Section

Added to [`AdminSupport.tsx`](nalogai/frontend/src/pages/admin/AdminSupport.tsx) — shows:
- **Income/Expense/Net** summary cards
- **Form 910 progress bar** with threshold warning
- **Tax obligations breakdown** (IPN, Social Tax, OPV, OSMS, Total)

---

## 2. Password Recovery (SMTP)

### 64-Character Hex Token

Updated [`AuthService.ts`](nalogai/backend/src/services/AuthService.ts:197) — `randomBytes(32).toString('hex')` generates a 64-char cryptographically secure token.

### Bilingual Email Template (RU/KK)

Updated [`MailService.ts`](nalogai/backend/src/services/MailService.ts) — professional template with:
- Russian section with reset button
- Kazakh section with reset button
- NalogAI Support signature with `support@nalogai.kz`
- Subject: "NalogAI — Сброс пароля / Құпия сөзді қалпына келтіру"

### Security Features
- Token expires after 1 hour
- Previous tokens invalidated on new request
- `tokenVersion` incremented on reset (invalidates all sessions)
- All refresh tokens revoked on reset
- Email enumeration prevention (always returns success)

---

## 3. Subscription Lifecycle

### Pro-Rata Extension

Updated [`PaymentService.ts`](nalogai/backend/src/services/PaymentService.ts:89) — when a user pays while a plan is active:
- If `accessUntil` is in the future → extend by 30 days from current `accessUntil`
- If `accessUntil` is null or expired → set to 30 days from now
- `autoRenew` reset to `true` on new payment

### Cancel Endpoint

`POST /api/payments/cancel` — sets `autoRenew = false` only. PRO access remains valid until `accessUntil`.

### Same-Plan Blocking

The `planRank` check in webhook handler prevents downgrade. The `subscribe` endpoint allows re-purchase (extends access).

---

## 4. Financial Audit Logging

### AuditLogService Actions

Extended [`AuditLogService.ts`](nalogai/backend/src/services/AuditLogService.ts) with:
- `PAYMENT_SUCCESS` — logs plan, amount, transactionId
- `PAYMENT_FAILED` — logs reason
- `SUBSCRIPTION_CANCELED` — logs plan and accessUntil
- `ADMIN_SUBSCRIPTION_OVERRIDE` — logs oldPlan/newPlan with admin ID

### PII Safety
- Logger redacts `iin`, `password`, `token`, `authorization`
- Admin UI masks IINs by default
- Financial details viewable in admin but logs redact sensitive data

---

## 5. Mobile Responsiveness

### Already Implemented
- All forms use `inputMode="numeric"` for IIN fields (triggers number pad)
- Buttons have minimum 44px touch targets via Tailwind's `py-2.5` (10px) + `h-11` (44px)
- Responsive grid layouts (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- Sidebar collapses on mobile with bottom tab bar

### Verified Pages
- [`Login.tsx`](nalogai/frontend/src/pages/Login.tsx) — responsive form
- [`Register.tsx`](nalogai/frontend/src/pages/Register.tsx) — responsive multi-step
- [`ForgotPassword.tsx`](nalogai/frontend/src/pages/ForgotPassword.tsx) — max-w-[400px] centered
- [`ResetPassword.tsx`](nalogai/frontend/src/pages/ResetPassword.tsx) — max-w-[400px] centered

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| [`AdminService.ts`](nalogai/backend/src/services/AdminService.ts) | Modified | Added `getUserFinances()` with Form 910 progress and tax calculations |
| [`admin.ts`](nalogai/backend/src/routes/admin.ts) | Modified | Added `GET /api/admin/users/:id/finances` route |
| [`admin.api.ts`](nalogai/frontend/src/api/admin.api.ts) | Modified | Added `getUserFinances()` API call and `UserFinances` type |
| [`AdminSupport.tsx`](nalogai/frontend/src/pages/admin/AdminSupport.tsx) | Modified | Added "Финансовая активность" section with progress bar and tax breakdown |
| [`MailService.ts`](nalogai/backend/src/services/MailService.ts) | Modified | Bilingual RU/KK template with NalogAI Support signature |
| [`AuthService.ts`](nalogai/backend/src/services/AuthService.ts) | Modified | 64-char hex token via `randomBytes(32)` |
| [`PaymentService.ts`](nalogai/backend/src/services/PaymentService.ts) | Modified | Pro-rata 30-day extension on re-purchase |

---

## MRP Verification

| Threshold | Calculation | Value |
|-----------|-------------|-------|
| Form 910 max | 24,038 × 4,325 | **103,964,350 ₸** |
| MRP 2026 | Budget Law | **4,325 ₸** |

All calculations use `MRP_2026 = 4,325` KZT exclusively.

---

## Conclusion

- ✅ **Admin Financial Deep Eye** — Real-time income/expense, Form 910 progress, tax obligations
- ✅ **Bilingual Password Reset** — 64-char hex token, RU/KK email template, session invalidation
- ✅ **Subscription Extension** — Pro-rata 30-day extension on re-purchase, cancel preserves access
- ✅ **Financial Audit Logging** — All payment actions logged with admin ID
- ✅ **Mobile Responsive** — 44px touch targets, inputMode="numeric", responsive grids
- ✅ **MRP Compliance** — All thresholds use 4,325 KZT
