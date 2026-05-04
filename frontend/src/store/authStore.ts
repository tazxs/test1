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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      planOverride: null,

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
