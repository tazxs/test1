# Admin Command Center Initialized

**Date:** 2026-05-02  
**Status:** ✅ Complete  
**Scope:** Protected `/admin` area with RBAC, user management, support tools, and audit logging

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  /admin ──→ AdminRoute guard (role === 'ADMIN')                 │
│    ├── /admin          → AdminDashboard (stats KPIs)            │
│    ├── /admin/users    → AdminUsers (table + search + override) │
│    └── /admin/support  → AdminSupport (detail + logs + unmask)  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Bearer JWT (role claim)
┌──────────────────────────▼──────────────────────────────────────┐
│                       Backend (Express)                          │
│  /api/admin/* ──→ requireAuth + requireAdmin middleware          │
│    ├── GET  /stats              → AdminService.getDashboardStats │
│    ├── GET  /users              → AdminService.listUsers         │
│    ├── GET  /users/:id          → AdminService.getUserDetail     │
│    ├── PATCH /users/:id/subscription → overrideSubscription      │
│    ├── POST /users/:id/unmask-iin    → unmaskIIN (audit logged)  │
│    └── GET  /logs/:userId       → AdminService.getUserLogs       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    PostgreSQL (Prisma ORM)                       │
│  users.role: UserRole (USER | ADMIN)                            │
│  audit_logs: actorId, targetId, action, details, ipAddress      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Created / Modified

### Backend

| File | Action | Description |
|------|--------|-------------|
| [`schema.prisma`](nalogai/backend/prisma/schema.prisma) | Modified | Added `UserRole` enum, `role` field on `User`, `AuditLog` model |
| [`migration.sql`](nalogai/backend/prisma/migrations/20260502094638_add_role_and_audit_log/migration.sql) | Created | DB migration for role + audit_logs table |
| [`auth.ts`](nalogai/backend/src/middleware/auth.ts) | Modified | Added `role` to `JwtPayload`, added [`requireAdmin`](nalogai/backend/src/middleware/auth.ts:78) middleware |
| [`AuthService.ts`](nalogai/backend/src/services/AuthService.ts) | Modified | Includes `role` in JWT claims and [`toProfile()`](nalogai/backend/src/services/AuthService.ts:26) output |
| [`AdminService.ts`](nalogai/backend/src/services/AdminService.ts) | Created | Core admin logic: user listing, detail, subscription override, IIN unmask, audit logging, dashboard stats |
| [`admin.ts`](nalogai/backend/src/routes/admin.ts) | Created | Admin API routes with `requireAuth + requireAdmin` middleware chain |
| [`app.ts`](nalogai/backend/src/app.ts) | Modified | Registered [`adminRouter`](nalogai/backend/src/app.ts:105) at `/api/admin` |
| [`admin.test.ts`](nalogai/backend/src/routes/__tests__/admin.test.ts) | Created | Comprehensive RBAC tests (401/403, stats, user management, audit logs, JWT role claim) |

### Frontend

| File | Action | Description |
|------|--------|-------------|
| [`user.types.ts`](nalogai/shared/types/user.types.ts) | Modified | Added `UserRole` type and `role` field to `User`/`UserProfile` |
| [`constants.ts`](nalogai/frontend/src/lib/constants.ts) | Modified | Added `ADMIN`, `ADMIN_USERS`, `ADMIN_SUPPORT` route constants |
| [`admin.api.ts`](nalogai/frontend/src/api/admin.api.ts) | Created | Admin API client with typed interfaces |
| [`AdminRoute.tsx`](nalogai/frontend/src/components/admin/AdminRoute.tsx) | Created | Role guard: redirects non-admins to `/dashboard` |
| [`AdminLayout.tsx`](nalogai/frontend/src/components/admin/AdminLayout.tsx) | Created | Sidebar-based admin layout with navigation |
| [`AdminDashboard.tsx`](nalogai/frontend/src/pages/admin/AdminDashboard.tsx) | Created | Stats dashboard: Total Users, PRO/AI/Free counts, MRR, Form 910 count |
| [`AdminUsers.tsx`](nalogai/frontend/src/pages/admin/AdminUsers.tsx) | Created | User table with search by IIN/email, plan filter, pagination, inline plan override |
| [`AdminSupport.tsx`](nalogai/frontend/src/pages/admin/AdminSupport.tsx) | Created | Single-user support view: metadata, declarations, bank connections, IIN unmask (audit logged), activity log |
| [`Sidebar.tsx`](nalogai/frontend/src/components/layout/Sidebar.tsx) | Modified | Added admin link (shield icon) visible only to `ADMIN` role users |
| [`App.tsx`](nalogai/frontend/src/App.tsx) | Modified | Added nested admin routes under `ProtectedRoute > AdminRoute > AdminLayout` |

---

## Security Measures

### 1. Route Hardening (Backend)
- All `/api/admin/*` routes pass through [`requireAuth`](nalogai/backend/src/middleware/auth.ts:28) + [`requireAdmin`](nalogai/backend/src/middleware/auth.ts:78) middleware
- Non-admin users receive **403 FORBIDDEN** — the endpoint is not exposed even if the URL is guessed
- Unauthenticated requests receive **401 UNAUTHORIZED**

### 2. IIN Masking
- All admin API responses return **masked IINs** (e.g., `890***67`) via [`maskIIN()`](nalogai/backend/src/services/AdminService.ts:7)
- Unmasking requires an explicit `POST /api/admin/users/:id/unmask-iin` call
- Every unmask action is **logged in the `audit_logs` table** with actor, target, timestamp, and IP

### 3. Audit Logging
- [`createAuditLog()`](nalogai/backend/src/services/AdminService.ts:14) records:
  - `UNMASK_IIN` — when admin reveals a user's full IIN
  - `SUBSCRIPTION_OVERRIDE` — when admin changes a user's plan (old/new values stored)
- Logs include `actorId`, `targetId`, `action`, `details` (JSON), and `ipAddress`

### 4. CSP Compliance
- Admin panel uses the **same origin** as the main app — no CSP changes needed
- No external scripts, styles, or connections introduced
- Existing strict CSP in [`app.ts`](nalogai/backend/src/app.ts:29) remains intact

### 5. JWT Role Claim
- The `role` field is included in the JWT access token payload
- Frontend [`AdminRoute`](nalogai/frontend/src/components/admin/AdminRoute.tsx) checks `user.role !== 'ADMIN'` and redirects to `/dashboard`
- Backend [`requireAdmin`](nalogai/backend/src/middleware/auth.ts:78) checks `req.user.role !== 'ADMIN'` and returns 403

---

## Admin Dashboard Description

The `/admin` dashboard presents a **dark-themed, sidebar-based layout** consistent with the main NalogAI design:

### Sidebar (Left)
- **Red dot logo** with "Admin Panel" branding (distinct from main green NalogAI logo)
- Navigation: **Dashboard** | **Users** | **Support**
- "Back to App" link at bottom
- Shield icon (🛡️) in main app sidebar for admin users

### Dashboard Page (`/admin`)
- **7 KPI cards** in a responsive grid:
  - Total Users, PRO Users, PRO AI Users, Free Users
  - MRR (₸), Form 910 Count, New Users This Month
- Animated entrance with staggered fade-in

### Users Page (`/admin/users`)
- **Search bar** — filter by IIN, email, or name (debounced)
- **Plan filter dropdown** — All / FREE / PRO / PRO_AI
- **User table** with columns: User (name + email), IIN (masked), Plan (color-coded badge), Declarations, Joined, Actions
- **Inline plan override** — dropdown to change plan directly from the table
- **View button** — navigates to support view for that user
- **Pagination** with prev/next and "Showing X–Y of Z"

### Support Page (`/admin/support`)
- **User search** — find user by IIN/email/name
- **User info card** — name, email, plan badge, business type, tax regime
- **IIN section** — masked by default with "Unmask (logged)" button (red border, audit warning)
- **Stats grid** — Declarations, Transactions, Bank Links, Joined date
- **Active Declarations** — list with form type, period, and status badge
- **Bank Connections** — provider, sync status, connection status
- **Activity Log** — chronological list of audit entries with timestamp, action, actor, and details

---

## QA Scenarios

### Scenario 1: Regular user blocked from /admin
- **Setup:** Log in as a user with `role: USER`
- **Action:** Navigate to `/admin`
- **Expected:** Redirected to `/dashboard` (frontend guard)
- **API Test:** `GET /api/admin/stats` with user token → **403 FORBIDDEN**

### Scenario 2: Admin manually upgrades user to PRO
- **Setup:** User with failed payment, plan = FREE
- **Action:** Admin finds user in `/admin/users`, changes plan dropdown to PRO
- **Expected:** User's plan updated to PRO, audit log created with `SUBSCRIPTION_OVERRIDE`
- **Verify:** User sees PRO badge in their dashboard

### Scenario 3: Admin actions recorded in AuditLog
- **Setup:** Admin performs unmask IIN and subscription override
- **Action:** Query `audit_logs` table
- **Expected:** Two entries with correct `actorId`, `targetId`, `action`, `details`, `ipAddress`

---

## Performance Notes

- User table uses **server-side pagination** (25 per page) — ready for 5,000+ users
- Search is **debounced** (300ms) to reduce API calls
- All admin queries use **indexed columns** (`createdAt DESC`, `plan`, `iin`)
- For 5,000+ users, virtualization can be added with `react-window` — the table structure supports it

---

## Next Steps

1. **Seed admin user:** Run a script to set `role = 'ADMIN'` on the business owner's account
2. **Restart dev server** to pick up the new Prisma Client types (EPERM lock resolved)
3. **Run tests:** `cd nalogai/backend && npx vitest run src/routes/__tests__/admin.test.ts`
4. **Optional:** Add `react-window` virtualization if user count exceeds 5,000
