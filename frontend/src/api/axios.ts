/// <reference types="vite/client" />
import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@store/authStore'
import type { SubscriptionPlan } from 'nalogai-shared/types/user.types'

// ── Module augmentation: extend Axios config with _retry flag ─────────────────
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

export const api = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] as string ?? '/api',
  withCredentials: true, // send httpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
})

export function getAcceptLanguage(): string {
  if (typeof window === 'undefined') return 'ru'
  const stored = window.localStorage.getItem('nalogai.language')
  if (stored === 'kk' || stored === 'ru' || stored === 'en') return stored
  return window.navigator.language || 'ru'
}

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token != null) {
    config.headers.Authorization = `Bearer ${token}`
  }
  config.headers['Accept-Language'] = getAcceptLanguage()
  return config
})

// ── Response interceptor: silent token refresh on 401 ────────────────────────
// Queue of pending resolvers waiting for a refresh to complete.
// Each entry is called with the new token on success, or null on failure.
let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

function redirectToLogin(): void {
  useAuthStore.getState().clearAuth()
  // Use replace so the user cannot go back to the broken page
  window.location.replace('/login')
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as AxiosError
    const original = axiosError.config as InternalAxiosRequestConfig | undefined

    // Pass through non-401 errors or requests without config
    if (axiosError.response?.status !== 401 || original == null) {
      return Promise.reject(error)
    }

    // If this request already retried once, the refresh token itself is invalid
    // or the user is genuinely unauthorized — hard logout and redirect.
    if (original._retry === true) {
      redirectToLogin()
      return Promise.reject(error)
    }

    // Mark as retried so a future 401 on the retried request triggers the block above
    original._retry = true

    // If a refresh is already in flight, queue this request until it resolves
    if (isRefreshing) {
      return new Promise<unknown>((resolve, reject) => {
        refreshQueue.push((token) => {
          if (token != null) {
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          } else {
            reject(error)
          }
        })
      })
    }

    isRefreshing = true

    try {
      // Use bare axios (not the intercepted `api` instance) to avoid infinite loops.
      const { data } = await axios.post<{ data: { accessToken: string } }>(
        '/api/auth/refresh',
        {},
        { withCredentials: true },
      )
      const newToken = data.data.accessToken

      // Persist new access token in memory store
      useAuthStore.getState().setAccessToken(newToken)

      // Sync plan from the refreshed JWT payload so the UI stays consistent
      try {
        const payload = JSON.parse(atob(newToken.split('.')[1]!)) as { plan?: string }
        if (payload.plan != null) {
          useAuthStore.getState().setPlan(payload.plan as SubscriptionPlan)
        }
      } catch {
        // Ignore malformed JWT — plan stays at previous value
      }

      // Unblock all queued requests with the new token
      refreshQueue.forEach((cb) => cb(newToken))
      refreshQueue = []

      // Retry the original request with the new token
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch {
      // Refresh failed — session is unrecoverable, redirect to login
      refreshQueue.forEach((cb) => cb(null))
      refreshQueue = []
      redirectToLogin()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)
