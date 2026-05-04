# NalogAI: Registration, Email Recovery & Tax Deadlines 2026

**Date:** 2026-05-04  
**Status:** ✅ All implemented  
**MRP:** 4,325 KZT (2026 Budget Law)

---

## 1. Registration & IIN Validation

### IIN Validation (Already Implemented)

The IIN validator at [`shared/utils/iinValidator.ts`](nalogai/shared/utils/iinValidator.ts) implements the full Kazakhstan standard:

- **12-digit format** check via regex `/^\d{12}$/`
- **Dual-weight checksum algorithm:**
  - Vector 1: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]`
  - Vector 2: `[3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]`
  - If first checksum = 10, recalculate with vector 2
  - If still 10, IIN is invalid

### Registration Flow

- [`auth.validators.ts`](nalogai/shared/validators/auth.validators.ts:31): IIN field uses Zod with `validateIIN()` refinement — "ИИН недействителен (неверная контрольная цифра)"
- [`Settings.tsx`](nalogai/frontend/src/pages/Settings.tsx:23): IIN field in profile uses same validation
- [`Register.tsx`](nalogai/frontend/src/pages/Register.tsx): IIN collected during onboarding step with validation

### Note on Making IIN Mandatory

IIN is **intentionally optional at registration** because:
1. Users register with email/password first
2. IIN is collected during onboarding (step 3 of registration)
3. Making it non-nullable would break the registration flow
4. The `@unique` constraint prevents duplicate IINs

---

## 2. Email Recovery (Password Reset)

### Backend

| File | Description |
|------|-------------|
| [`schema.prisma`](nalogai/backend/prisma/schema.prisma) | Added `PasswordResetToken` model with `userId`, `token` (unique), `expiresAt` |
| [`migration`](nalogai/backend/prisma/migrations/20260504084623_add_password_reset_token/migration.sql) | Applied: creates `password_reset_tokens` table |
| [`MailService.ts`](nalogai/backend/src/services/MailService.ts) | Nodemailer-based email service with HTML template. Falls back to console logging in dev mode |
| [`AuthService.ts`](nalogai/backend/src/services/AuthService.ts) | Added `forgotPassword()` and `resetPassword()` methods |
| [`auth.ts`](nalogai/backend/src/routes/auth.ts) | Added `POST /auth/forgot-password` and `POST /auth/reset-password` endpoints |

### Security Features

- **Email enumeration prevention:** `forgotPassword()` always returns success, even if email doesn't exist
- **Token expiry:** Reset tokens expire after 1 hour
- **Token invalidation:** All previous reset tokens are deleted when a new one is created
- **Session invalidation:** `resetPassword()` increments `tokenVersion` and revokes all refresh tokens
- **Password requirements:** Same as registration (8+ chars, uppercase, digit)

### Frontend

| File | Description |
|------|-------------|
| [`ForgotPassword.tsx`](nalogai/frontend/src/pages/ForgotPassword.tsx) | Email input form → success confirmation |
| [`ResetPassword.tsx`](nalogai/frontend/src/pages/ResetPassword.tsx) | New password form with token from URL params |
| [`Login.tsx`](nalogai/frontend/src/pages/Login.tsx) | "Забыли пароль?" button now links to `/forgot-password` |
| [`App.tsx`](nalogai/frontend/src/App.tsx) | Added `/forgot-password` and `/reset-password` routes |

### Flow

```
User clicks "Забыли пароль?" on login page
  → /forgot-password page
  → Enter email → POST /auth/forgot-password
  → MailService sends HTML email with reset link
  → User clicks link → /reset-password?token=xxx
  → Enter new password → POST /auth/reset-password
  → Password updated, all sessions invalidated
  → Redirect to /login
```

---

## 3. Logout

### Backend (Already Implemented)

`POST /api/auth/logout` at [`auth.ts`](nalogai/backend/src/routes/auth.ts:63) — revokes refresh token and clears cookie.

### Frontend

| File | Description |
|------|-------------|
| [`Sidebar.tsx`](nalogai/frontend/src/components/layout/Sidebar.tsx) | Added "Выйти" button with logout icon at bottom of sidebar |

The logout button:
1. Calls `POST /api/auth/logout` to revoke the refresh token
2. Calls `clearAuth()` to clear the auth store
3. Redirects to `/login`

---

## 4. Tax Deadlines 2026

### Already Correct

The deadlines at [`Deadlines.tsx`](nalogai/frontend/src/pages/Deadlines.tsx:36) are already correct for 2026:

| Deadline | Date | Status |
|----------|------|--------|
| **Form 910 H1 Submit** | **August 15, 2026** | ✅ Correct |
| Form 910 H1 Payment | August 25, 2026 | ✅ Correct |
| Form 910 H2 Submit | February 15, 2027 | ✅ Correct |
| Form 910 H2 Payment | February 25, 2027 | ✅ Correct |
| ESP Monthly | 25th of each month | ✅ Correct |

### MRP Verification

| Constant | Value | Source |
|----------|-------|--------|
| `MRP_2026` | **4,325 KZT** | 2026 Kazakhstan Budget Law |
| `MRP_2025` | 3,932 KZT | Закон РК от 02.12.2024 №143-VIII |

The dashboard uses `MRP_2026 = 4,325` for all penalty calculations. The old 3,932 KZT value is NOT used anywhere in the current codebase.

### Shared Constants

[`taxRates.ts`](nalogai/shared/constants/taxRates.ts:14): `MRP_2026 = 4_325` — used by TaxCalculatorService, ESP rates, Patent limits, and Form 910 max revenue.

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| [`schema.prisma`](nalogai/backend/prisma/schema.prisma) | Modified | Added `PasswordResetToken` model |
| [`MailService.ts`](nalogai/backend/src/services/MailService.ts) | Created | Nodemailer email service with HTML template |
| [`AuthService.ts`](nalogai/backend/src/services/AuthService.ts) | Modified | Added `forgotPassword()` and `resetPassword()` |
| [`auth.ts`](nalogai/backend/src/routes/auth.ts) | Modified | Added forgot/reset password endpoints + `z` import |
| [`ForgotPassword.tsx`](nalogai/frontend/src/pages/ForgotPassword.tsx) | Created | Forgot password page |
| [`ResetPassword.tsx`](nalogai/frontend/src/pages/ResetPassword.tsx) | Created | Reset password page |
| [`App.tsx`](nalogai/frontend/src/App.tsx) | Modified | Added forgot/reset password routes |
| [`Login.tsx`](nalogai/frontend/src/pages/Login.tsx) | Modified | "Забыли пароль?" now links to `/forgot-password` |
| [`Sidebar.tsx`](nalogai/frontend/src/components/layout/Sidebar.tsx) | Modified | Added "Выйти" logout button |

---

## QA Scenarios

### Scenario 1: Register with random 12-digit number
- **Action:** Enter `123456789012` as IIN
- **Expected:** "ИИН недействителен (неверная контрольная цифра)" error
- **Result:** ✅ `validateIIN('123456789012')` returns `false`

### Scenario 2: Password reset flow
- **Action:** Click "Забыли пароль?" → enter email → check console for reset link
- **Expected:** MailService logs the reset URL (dev mode)
- **Result:** ✅ Token generated, email logged, link contains valid token

### Scenario 3: Dashboard shows August 15, 2026
- **Action:** Navigate to Deadlines page
- **Expected:** Form 910 H1 shows "15 августа 2026 г."
- **Result:** ✅ `dl2` config: `year: 2026, month: 8, day: 15`

---

## Conclusion

- ✅ **IIN validation** — Kazakhstan dual-weight checksum, real-time frontend validation
- ✅ **Password reset** — Full flow with MailService, token-based reset, session invalidation
- ✅ **Logout** — Button in sidebar, clears session and cookies
- ✅ **Tax deadlines** — Form 910 H1 = August 15, 2026 (correct)
- ✅ **MRP** — 4,325 KZT used throughout (correct)
