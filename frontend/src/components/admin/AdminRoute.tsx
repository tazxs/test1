import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import { ROUTES } from '@lib/constants'

/**
 * Admin route guard. Redirects non-admin users to the dashboard.
 * Must be used inside a ProtectedRoute (user is already authenticated).
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) return null
  if (!user || user.role !== 'ADMIN') return <Navigate to={ROUTES.DASHBOARD} replace />

  return <>{children}</>
}
