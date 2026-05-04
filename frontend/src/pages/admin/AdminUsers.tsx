import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getAdminUsers, overrideSubscription, type AdminUser } from '@api/admin.api'
import { toast } from '@store/notificationStore'
import { cn } from '@utils/cn'
import { formatDate } from '@utils/formatDate'

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-white-dim/10 text-white-dim',
  PRO: 'bg-green/10 text-green',
  PRO_AI: 'bg-blue-400/10 text-blue-400',
}

const PLAN_OPTIONS = ['', 'FREE', 'PRO', 'PRO_AI'] as const

// ── Skeleton Row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-navy-3 animate-pulse" style={{ width: i === 0 ? '60%' : i === 5 ? '80px' : '50%' }} />
        </td>
      ))}
    </tr>
  )
}

export function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [page, setPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAdminUsers({
        page,
        limit: 25,
        search: search || undefined,
        plan: planFilter || undefined,
      })
      setUsers(result.items)
      setMeta(result.meta)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load users'
      setError(message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [page, search, planFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
    }, 300)
  }

  const handlePlanOverride = async (userId: string, newPlan: string) => {
    setActionLoading(userId)
    try {
      const result = await overrideSubscription(userId, newPlan)
      toast.success(
        `Plan updated to ${result.plan}`,
        'User may need to relog or wait for token refresh to see the change.',
      )
      await fetchUsers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to update plan', message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-white mb-6">User Management</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by IIN, email, or name..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-navy-3 px-4 py-2.5 font-body text-sm text-white placeholder:text-white-dim/40 focus:border-green focus:outline-none focus:ring-1 focus:ring-green/30"
        />
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-border bg-navy-3 px-4 py-2.5 font-body text-sm text-white focus:border-green focus:outline-none"
        >
          <option value="">All Plans</option>
          <option value="FREE">Free</option>
          <option value="PRO">PRO</option>
          <option value="PRO_AI">PRO AI</option>
        </select>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-xl border border-red/20 bg-red/5 p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-body text-sm font-semibold text-red">Failed to load users</p>
            <p className="font-mono text-[11px] text-red/70 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchUsers}
            className="rounded-lg border border-red/30 bg-red/10 px-4 py-2 font-body text-sm font-semibold text-red hover:bg-red/20 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-navy-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white-dim/60">User</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white-dim/60">IIN</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white-dim/60">Plan</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white-dim/60">Declarations</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white-dim/60">Joined</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white-dim/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton loader — 8 placeholder rows
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center font-body text-sm text-white-dim">
                    Unable to load data. Click "Retry" above.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center font-body text-sm text-white-dim">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user, i) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border/50 hover:bg-white-ghost/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-body text-sm text-white font-medium">{user.fullName ?? '—'}</p>
                        <p className="font-mono text-[11px] text-white-dim/60">{user.email ?? '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-white-dim">
                      {user.iin ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold', PLAN_COLORS[user.plan] ?? PLAN_COLORS.FREE)}>
                        {user.plan ?? 'FREE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-white-dim">
                      {user.declarationCount ?? 0}
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-white-dim">
                      {user.createdAt ? formatDate(user.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/support?userId=${user.id}`)}
                          className="rounded-md border border-border px-2.5 py-1 font-mono text-[11px] text-white-dim hover:text-white hover:border-white-dim transition-colors"
                        >
                          View
                        </button>
                        <select
                          value={user.plan ?? 'FREE'}
                          onChange={(e) => handlePlanOverride(user.id, e.target.value)}
                          disabled={actionLoading === user.id}
                          className="rounded-md border border-border bg-navy-3 px-2 py-1 font-mono text-[11px] text-white-dim focus:border-green focus:outline-none disabled:opacity-50"
                        >
                          {PLAN_OPTIONS.filter(Boolean).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="font-mono text-[11px] text-white-dim/60">
              Showing {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!meta.hasPrevPage}
                className="rounded-md border border-border px-3 py-1 font-mono text-[11px] text-white-dim hover:text-white disabled:opacity-30 transition-colors"
              >
                Prev
              </button>
              <span className="font-mono text-[11px] text-white-dim">
                {meta.page} / {meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!meta.hasNextPage}
                className="rounded-md border border-border px-3 py-1 font-mono text-[11px] text-white-dim hover:text-white disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
