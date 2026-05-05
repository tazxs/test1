import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, SubscriptionPlan } from 'nalogai-shared/types/user.types'

interface AuthState {
  user: UserProfile | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  // Stored independently so clearAuth() (triggered by 401 interceptor) cannot wipe it
  planOverride: SubscriptionPlan | null

  setUser: (user: UserProfile, accessToken: string) => void
  setAccessToken: (token: string) => void
  setPlan: (plan: SubscriptionPlan) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

// ── BETA TEST MODE ──────────────────────────────────────────────────────────
// Auto-authenticate with a mock user for beta testing.
// This bypasses login/registration to allow direct dashboard access.
const BETA_USER: UserProfile = {
  id: 'beta_tester',
  email: 'beta@nalogai.kz',
  fullName: 'Beta User',
  iin: null,
  role: 'ADMIN',
  plan: 'PRO_AI',
  businessType: 'SELF_EMPLOYED',
  taxRegime: 'SIMPLIFIED_DECLARATION',
  preferredLanguage: 'ru',
}

// Set dummy auth token in localStorage if not present
if (typeof window !== 'undefined' && !localStorage.getItem('nalogai-auth')) {
  localStorage.setItem('nalogai-auth', JSON.stringify({
    state: { isAuthenticated: true, planOverride: 'PRO_AI' },
    version: 0,
  }))
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: BETA_USER,
      accessToken: 'beta_test_token',
      isAuthenticated: true,
      isLoading: false,
      planOverride: 'PRO_AI',

      setUser: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      // Update both user.plan (if user exists) and planOverride.
      // planOverride survives clearAuth so it is never lost due to 401 interceptor resets.
      setPlan: (plan) =>
        set((s) => ({
          planOverride: plan,
          user: s.user ? { ...s.user, plan } : s.user,
        })),

      // clearAuth intentionally does NOT reset planOverride — the plan was paid for.
      clearAuth: () => {
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
        try { localStorage.removeItem('nalogai-auth') } catch { /* SSR safety */ }
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'nalogai-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        planOverride: state.planOverride,
      }),
    }
  )
)

// Helper — resolves the effective plan from override or user profile
export function getEffectivePlan(state: Pick<AuthState, 'user' | 'planOverride'>): SubscriptionPlan {
  return state.planOverride ?? state.user?.plan ?? 'FREE'
}
