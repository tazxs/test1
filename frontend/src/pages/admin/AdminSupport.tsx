import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  getAdminUsers,
  getAdminUserDetail,
  unmaskIIN,
  getUserFinances,
  overrideSubscription,
  type AdminUser,
  type AdminUserDetail,
  type UserFinances,
} from '@api/admin.api'
import { UserActivityTimeline } from '@components/admin/UserActivityTimeline'
import { toast } from '@store/notificationStore'
import { cn } from '@utils/cn'
import { formatDate } from '@utils/formatDate'

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-white-dim/10 text-white-dim',
  PRO: 'bg-green/10 text-green',
  PRO_AI: 'bg-blue-400/10 text-blue-400',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-white-dim/10 text-white-dim',
  READY: 'bg-yellow-400/10 text-yellow-400',
  SUBMITTED: 'bg-blue-400/10 text-blue-400',
  ACCEPTED: 'bg-green/10 text-green',
  REJECTED: 'bg-red/10 text-red',
}

export function AdminSupport() {
  const [searchParams, setSearchParams] = useSearchParams()
  const userId = searchParams.get('userId')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AdminUser[]>([])
  const [searching, setSearching] = useState(false)
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null)
  const [finances, setFinances] = useState<UserFinances | null>(null)
  const [loading, setLoading] = useState(false)
  const [unmaskedIIN, setUnmaskedIIN] = useState<string | null>(null)
  const [unmaskLoading, setUnmaskLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load user detail when userId is set
  const loadUserDetail = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const [detail, userFinances] = await Promise.all([
        getAdminUserDetail(id),
        getUserFinances(id),
      ])
      setUserDetail(detail)
      setFinances(userFinances)
      setUnmaskedIIN(null) // Reset unmasked state on new user
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load user'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) {
      loadUserDetail(userId)
    }
  }, [userId, loadUserDetail])

  // Search users
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const result = await getAdminUsers({ search: searchQuery, limit: 10 })
      setSearchResults(result.items)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSelectUser = (id: string) => {
    setSearchParams({ userId: id })
    setSearchQuery('')
    setSearchResults([])
  }

  const handleUnmaskIIN = async () => {
    if (!userId) return
    setUnmaskLoading(true)
    try {
      const result = await unmaskIIN(userId)
      setUnmaskedIIN(result.iin)
    } catch (err) {
      console.error('Failed to unmask IIN:', err)
    } finally {
      setUnmaskLoading(false)
    }
  }

  const handlePlanOverride = async (newPlan: string) => {
    if (!userId) return
    setActionLoading(true)
    try {
      const result = await overrideSubscription(userId, newPlan)
      toast.success(
        `Plan updated to ${result.plan}`,
        'User may need to relog or wait for token refresh to see the change.',
      )
      await loadUserDetail(userId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to update plan', message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-white mb-6">Support View</h1>

      {/* User Search */}
      <div className="rounded-xl border border-border bg-navy-2 p-5 mb-6">
        <h2 className="font-body text-sm font-semibold text-white mb-3">Find User</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by IIN, email, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 rounded-lg border border-border bg-navy-3 px-4 py-2.5 font-body text-sm text-white placeholder:text-white-dim/40 focus:border-green focus:outline-none focus:ring-1 focus:ring-green/30"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="rounded-lg bg-red px-5 py-2.5 font-body text-sm font-semibold text-white hover:bg-red/80 transition-colors disabled:opacity-50"
          >
            {searching ? '...' : 'Search'}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-navy-3 divide-y divide-border/50">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white-ghost/30 transition-colors text-left"
              >
                <div>
                  <p className="font-body text-sm text-white font-medium">{user.fullName}</p>
                  <p className="font-mono text-[11px] text-white-dim/60">{user.email} · {user.iin ?? 'No IIN'}</p>
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold', PLAN_COLORS[user.plan])}>
                  {user.plan}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User Detail */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-red/20 border-t-red rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red/20 bg-red/5 p-6 text-red font-body text-sm">
          {error}
        </div>
      )}

      {!userId && !loading && (
        <div className="rounded-xl border border-border bg-navy-2 p-12 text-center">
          <p className="font-body text-white-dim">Search for a user to view their details</p>
        </div>
      )}

      {userDetail && !loading && (
        <div className="space-y-6">
          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-navy-2 p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="font-display text-xl text-white">{userDetail.fullName}</h2>
                <p className="font-mono text-sm text-white-dim mt-1">{userDetail.email}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className={cn('rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold', PLAN_COLORS[userDetail.plan])}>
                    {userDetail.plan}
                  </span>
                  <span className="font-mono text-[11px] text-white-dim/60">
                    {userDetail.businessType} · {userDetail.taxRegime}
                  </span>
                </div>
              </div>

              {/* Plan Override */}
              <div className="flex items-center gap-2">
                <label className="font-mono text-[11px] text-white-dim/60">Override Plan:</label>
                <select
                  value={userDetail.plan}
                  onChange={(e) => handlePlanOverride(e.target.value)}
                  disabled={actionLoading}
                  className="rounded-md border border-border bg-navy-3 px-3 py-1.5 font-mono text-sm text-white focus:border-green focus:outline-none disabled:opacity-50"
                >
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                  <option value="PRO_AI">PRO_AI</option>
                </select>
              </div>
            </div>

            {/* IIN with unmask */}
            <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-navy-3 border border-border/50">
              <span className="font-mono text-[11px] uppercase tracking-wider text-white-dim/60">IIN:</span>
              <span className="font-mono text-sm text-white">
                {unmaskedIIN ?? userDetail.iin ?? 'Not set'}
              </span>
              {!unmaskedIIN && userDetail.iin && (
                <button
                  onClick={handleUnmaskIIN}
                  disabled={unmaskLoading}
                  className="ml-auto rounded-md border border-red/30 bg-red/5 px-3 py-1 font-mono text-[11px] text-red hover:bg-red/10 transition-colors disabled:opacity-50"
                >
                  {unmaskLoading ? '...' : 'Unmask (logged)'}
                </button>
              )}
              {unmaskedIIN && (
                <span className="ml-auto font-mono text-[10px] text-yellow-400/60">⚠ Unmasked — action logged</span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg bg-navy-3 p-3">
                <p className="font-mono text-[10px] uppercase text-white-dim/60">Declarations</p>
                <p className="font-display text-lg text-white">{userDetail.declarationCount}</p>
              </div>
              <div className="rounded-lg bg-navy-3 p-3">
                <p className="font-mono text-[10px] uppercase text-white-dim/60">Transactions</p>
                <p className="font-display text-lg text-white">{userDetail.transactionCount}</p>
              </div>
              <div className="rounded-lg bg-navy-3 p-3">
                <p className="font-mono text-[10px] uppercase text-white-dim/60">Bank Links</p>
                <p className="font-display text-lg text-white">{userDetail.bankConnections.length}</p>
              </div>
              <div className="rounded-lg bg-navy-3 p-3">
                <p className="font-mono text-[10px] uppercase text-white-dim/60">Joined</p>
                <p className="font-body text-sm text-white">{formatDate(userDetail.createdAt)}</p>
              </div>
            </div>
          </motion.div>

          {/* Declarations */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-navy-2 p-6"
          >
            <h3 className="font-body text-sm font-semibold text-white mb-4">Active Declarations</h3>
            {userDetail.declarations.length === 0 ? (
              <p className="font-body text-sm text-white-dim">No declarations</p>
            ) : (
              <div className="space-y-2">
                {userDetail.declarations.map((decl) => (
                  <div
                    key={decl.id}
                    className="flex items-center justify-between rounded-lg bg-navy-3 px-4 py-3"
                  >
                    <div>
                      <span className="font-mono text-sm text-white">{decl.formType}</span>
                      <span className="mx-2 text-white-dim/30">·</span>
                      <span className="font-mono text-sm text-white-dim">{decl.period}</span>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold', STATUS_COLORS[decl.status])}>
                      {decl.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Bank Connections */}
          {userDetail.bankConnections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-border bg-navy-2 p-6"
            >
              <h3 className="font-body text-sm font-semibold text-white mb-4">Bank Connections</h3>
              <div className="space-y-2">
                {userDetail.bankConnections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between rounded-lg bg-navy-3 px-4 py-3"
                  >
                    <span className="font-mono text-sm text-white">{conn.provider}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-white-dim">{conn.syncStatus}</span>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 font-mono text-[10px]',
                        conn.status === 'ACTIVE' ? 'bg-green/10 text-green' : 'bg-red/10 text-red',
                      )}>
                        {conn.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Financial Activity */}
          {finances && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="rounded-xl border border-border bg-navy-2 p-6"
            >
              <h3 className="font-body text-sm font-semibold text-white mb-4">Финансовая активность</h3>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-navy-3 p-3">
                  <p className="font-mono text-[10px] uppercase text-white-dim/60">Доход</p>
                  <p className="font-display text-lg text-green">{finances.summary.totalIncome.toLocaleString('ru-RU')} ₸</p>
                </div>
                <div className="rounded-lg bg-navy-3 p-3">
                  <p className="font-mono text-[10px] uppercase text-white-dim/60">Расход</p>
                  <p className="font-display text-lg text-red">{finances.summary.totalExpense.toLocaleString('ru-RU')} ₸</p>
                </div>
                <div className="rounded-lg bg-navy-3 p-3">
                  <p className="font-mono text-[10px] uppercase text-white-dim/60">Чистый доход</p>
                  <p className="font-display text-lg text-white">{finances.summary.netIncome.toLocaleString('ru-RU')} ₸</p>
                </div>
              </div>

              {/* Form 910 Progress */}
              <div className="mb-4 p-3 rounded-lg bg-navy-3 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] text-white-dim">Прогресс до лимита 910.00</span>
                  <span className={cn('font-mono text-[11px] font-semibold', finances.form910Progress.exceedsThreshold ? 'text-red' : 'text-green')}>
                    {finances.form910Progress.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-navy-4 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', finances.form910Progress.exceedsThreshold ? 'bg-red' : 'bg-green')}
                    style={{ width: `${Math.min(100, finances.form910Progress.percent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-mono text-[10px] text-white-dim/50">{finances.form910Progress.currentIncome.toLocaleString('ru-RU')} ₸</span>
                  <span className="font-mono text-[10px] text-white-dim/50">{finances.form910Progress.threshold.toLocaleString('ru-RU')} ₸</span>
                </div>
                {finances.form910Progress.exceedsThreshold && (
                  <p className="font-mono text-[11px] text-red mt-2">⚠ Превышен лимит! Необходим переход на общий режим.</p>
                )}
              </div>

              {/* Tax Obligations */}
              <div className="p-3 rounded-lg bg-navy-3 border border-border/50">
                <p className="font-mono text-[11px] text-white-dim mb-2">Налоговые обязательства (расчёт)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between"><span className="font-mono text-[11px] text-white-dim/60">ИПН (1.5%)</span><span className="font-mono text-[11px] text-white">{finances.taxObligations.ipn.toLocaleString('ru-RU')} ₸</span></div>
                  <div className="flex justify-between"><span className="font-mono text-[11px] text-white-dim/60">СН (1.5%)</span><span className="font-mono text-[11px] text-white">{finances.taxObligations.socialTax.toLocaleString('ru-RU')} ₸</span></div>
                  <div className="flex justify-between"><span className="font-mono text-[11px] text-white-dim/60">ОПВ (10%)</span><span className="font-mono text-[11px] text-white">{finances.taxObligations.pensionContribution.toLocaleString('ru-RU')} ₸</span></div>
                  <div className="flex justify-between"><span className="font-mono text-[11px] text-white-dim/60">ОСМС</span><span className="font-mono text-[11px] text-white">{finances.taxObligations.medicalInsurance.toLocaleString('ru-RU')} ₸</span></div>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t border-border/50">
                  <span className="font-mono text-[11px] font-semibold text-white">Итого</span>
                  <span className="font-mono text-[11px] font-semibold text-white">{finances.taxObligations.totalTaxBurden.toLocaleString('ru-RU')} ₸</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Zero-Trust Non-Repudiation Audit Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-navy-2 p-6"
          >
            {userId && <UserActivityTimeline userId={userId} limit={100} />}
          </motion.div>
        </div>
      )}
    </div>
  )
}

