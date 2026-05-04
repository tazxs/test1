/// <reference types="vite/client" />
import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { PAGE_TRANSITION, PAGE_TRANSITION_CONFIG } from '@lib/motion'

import { ErrorBoundary } from '@components/ErrorBoundary'
import { ToastContainer } from '@components/ui/Toast'
import { AppLayout } from '@components/layout/PageWrapper'
import { Sidebar } from '@components/layout/Sidebar'
import { useAuthStore } from '@store/authStore'
import { useUIStore } from '@store/uiStore'
import { ROUTES } from '@lib/constants'
import { LanguageSelector } from './i18n/LanguageSelector'
import { getCurrentLanguage, hasStoredLanguagePreference, setLanguage, type SupportedLanguage } from './i18n'
import type { UserProfile } from 'nalogai-shared/types/user.types'
import { updateProfileApi } from '@api/users.api'

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
const Landing = lazy(() => import('@pages/Landing').then((m) => ({ default: m.Landing })))
const Login = lazy(() => import('@pages/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('@pages/Register').then((m) => ({ default: m.Register })))
const Dashboard = lazy(() => import('@pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Transactions = lazy(() => import('@pages/Transactions').then((m) => ({ default: m.Transactions })))
const Declarations = lazy(() => import('@pages/Declarations').then((m) => ({ default: m.Declarations })))
const DeclarationDetail = lazy(() => import('@pages/DeclarationDetail').then((m) => ({ default: m.DeclarationDetail })))
const AIAdvisor = lazy(() => import('@pages/AIAdvisor').then((m) => ({ default: m.AIAdvisor })))
const Deadlines = lazy(() => import('@pages/Deadlines').then((m) => ({ default: m.Deadlines })))
const Analytics = lazy(() => import('@pages/Analytics').then((m) => ({ default: m.Analytics })))
const Settings = lazy(() => import('@pages/Settings').then((m) => ({ default: m.Settings })))
const Billing = lazy(() => import('@pages/Billing').then((m) => ({ default: m.Billing })))
const Pricing = lazy(() => import('@pages/Pricing').then((m) => ({ default: m.Pricing })))
const TermsOfService = lazy(() => import('@pages/TermsOfService').then((m) => ({ default: m.TermsOfService })))
const PrivacyPolicy = lazy(() => import('@pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })))
const ForgotPassword = lazy(() => import('@pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('@pages/ResetPassword').then((m) => ({ default: m.ResetPassword })))

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminDashboard = lazy(() => import('@pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const AdminUsers = lazy(() => import('@pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })))
const AdminSupport = lazy(() => import('@pages/admin/AdminSupport').then((m) => ({ default: m.AdminSupport })))
const AdminLayout = lazy(() => import('@components/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminRoute = lazy(() => import('@components/admin/AdminRoute').then((m) => ({ default: m.AdminRoute })))

// ── Session bootstrap ─────────────────────────────────────────────────────────
// On every app mount: if we have isAuthenticated=true in localStorage but user/token
// are not in memory (page refresh, new tab), restore the session via the httpOnly
// refresh cookie → then fetch /me with the new access token.
function useBootstrap() {
  const { isAuthenticated, user, setUser, clearAuth, setLoading } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || user) return

    const baseURL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api'
    setLoading(true)

    ;(async () => {
      try {
        const { data: r1 } = await axios.post<{ data: { accessToken: string } }>(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        const token = r1.data.accessToken

        const { data: r2 } = await axios.get<{ data: { user: UserProfile } }>(
          `${baseURL}/auth/me`,
          { headers: { Authorization: `Bearer ${token}` }, withCredentials: true },
        )

        setUser(r2.data.user, token)
      } catch {
        clearAuth()
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// ── Profile refresh on focus ──────────────────────────────────────────────────
// When the user returns to the tab, silently refresh their profile.
// If an admin changed their plan (tokenVersion mismatch), the next API call
// will get a 401 → the axios interceptor will refresh the token → the new
// JWT will contain the updated plan. This hook accelerates that by proactively
// fetching /auth/me on focus.
function useProfileRefreshOnFocus() {
  const { isAuthenticated, accessToken, setUser } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return

    const baseURL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api'

    async function refreshProfile() {
      try {
        const { data } = await axios.get<{ data: { user: UserProfile } }>(
          `${baseURL}/auth/me`,
          { headers: { Authorization: `Bearer ${accessToken}` }, withCredentials: true },
        )
        setUser(data.data.user, accessToken!)
      } catch {
        // Silently fail — the axios interceptor handles 401s
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshProfile()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated, accessToken, setUser])
}

// ── Page loading fallback ─────────────────────────────────────────────────────
function PageLoader() {
  const { t } = useTranslation()

  return (
    <div className="min-h-dvh bg-navy flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-green/20 border-t-green rounded-full animate-spin" />
        <p className="font-body text-sm text-white-dim">{t('dashboard.loading')}</p>
      </div>
    </div>
  )
}

// ── Protected route wrapper ────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />
  return <>{children}</>
}

// ── App shell with sidebar (authenticated pages) ───────────────────────────────
function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore()
  const location = useLocation()
  return (
    <AppLayout sidebar={<Sidebar collapsed={sidebarCollapsed} />}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={PAGE_TRANSITION}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={PAGE_TRANSITION_CONFIG}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </AppLayout>
  )
}

function LanguagePrompt() {
  const { t } = useTranslation()
  const { user, accessToken, setUser } = useAuthStore()
  const [visible, setVisible] = useState(() => !hasStoredLanguagePreference())

  if (!visible) return null

  async function persistLanguage(language: SupportedLanguage) {
    await setLanguage(language)
    if (user != null && accessToken != null) {
      try {
        const updated = await updateProfileApi({ preferredLanguage: language })
        setUser(updated, accessToken)
      } catch (error) {
        console.warn('Failed to persist language preference:', error)
      }
    }
    setVisible(false)
  }

  function handlePick(language: SupportedLanguage) {
    void persistLanguage(language)
  }

  function handleContinue() {
    void persistLanguage(getCurrentLanguage())
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-navy/80 px-4 backdrop-blur-[10px]">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-[380px] rounded-2xl border border-border bg-navy-2 p-6 shadow-2xl"
      >
        <h2 className="font-display text-[24px] text-white">{t('common.languagePromptTitle')}</h2>
        <p className="mt-2 font-body text-[14px] text-white-dim">{t('common.languagePromptText')}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(['ru', 'kk', 'en'] as const).map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => handlePick(language)}
              className="rounded-xl border border-border bg-navy-3 px-3 py-3 font-mono text-[13px] font-semibold text-white transition-colors hover:border-green hover:text-green"
            >
              {language === 'kk' ? 'ҚАЗ' : language.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="mt-5">
          <LanguageSelector />
        </div>
        <button
          type="button"
          onClick={handleContinue}
          className="mt-5 w-full rounded-lg bg-green px-4 py-2.5 font-body text-[14px] font-semibold text-navy transition-colors hover:bg-green-dim"
        >
          {t('common.continue')}
        </button>
      </motion.div>
    </div>
  )
}

// ── Root app ───────────────────────────────────────────────────────────────────
export function App() {
  useBootstrap()
  useProfileRefreshOnFocus()

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
            {/* Public routes */}
            <Route path={ROUTES.HOME} element={<Landing />} />
            <Route path={ROUTES.LOGIN} element={<Login />} />
            <Route path={ROUTES.REGISTER} element={<Register />} />
            <Route path={ROUTES.PRICING} element={<Pricing />} />
            <Route path={ROUTES.TERMS} element={<TermsOfService />} />
            <Route path={ROUTES.PRIVACY} element={<PrivacyPolicy />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route
              path={ROUTES.DASHBOARD}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Dashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.TRANSACTIONS}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Transactions />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.DECLARATIONS}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Declarations />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.DECLARATION_DETAIL}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DeclarationDetail />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.AI_ADVISOR}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AIAdvisor />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.DEADLINES}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Deadlines />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.ANALYTICS}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Analytics />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.SETTINGS}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Settings />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.BILLING}
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Billing />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Admin routes — protected by role, wrapped in ErrorBoundary */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ErrorBoundary>
                      <AdminLayout />
                    </ErrorBoundary>
                  </AdminRoute>
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="support" element={<AdminSupport />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Routes>
        </Suspense>

      {/* Global toast container */}
      <ToastContainer />
      <LanguagePrompt />
    </BrowserRouter>
  )
}
