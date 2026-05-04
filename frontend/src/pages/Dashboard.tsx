import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { KPICard } from '@components/dashboard/KPICard'
import { IncomeChart } from '@components/dashboard/IncomeChart'
import { AddTransactionModal } from '@components/transactions/AddTransactionModal'
import { FAB } from '@components/ui/FAB'
import { useAuthStore } from '@store/authStore'
import { useTransactionStore } from '@store/transactionStore'
import { apiFetchTransactions } from '@api/transactions'
import { mockDeadlines } from '@mocks/mockData'
import type { ChartMonth } from '@mocks/mockData'
import { ROUTES } from '@lib/constants'
import { cn } from '@utils/cn'
import { formatNumber } from '@utils/formatCurrency'
import { getIntlLocale } from '../i18n'
import type { Transaction } from 'nalogai-shared/types/transaction.types'

const QUARTER_OPTIONS = [
  { value: 'Q1-2026', quarter: 1, year: 2026 },
  { value: 'Q4-2025', quarter: 4, year: 2025 },
  { value: 'Q3-2025', quarter: 3, year: 2025 },
  { value: 'Q2-2025', quarter: 2, year: 2025 },
  { value: 'Q1-2025', quarter: 1, year: 2025 },
]

// "Q1-2026" → { dateFrom: "2026-01-01", dateTo: "2026-03-31" }
function parseQuarter(value: string): { dateFrom: string; dateTo: string } {
  const [qStr, yearStr] = value.split('-')
  const q = parseInt(qStr!.slice(1))
  const year = parseInt(yearStr!)
  const monthStart = (q - 1) * 3 + 1
  const monthEnd = q * 3
  const lastDay = new Date(year, monthEnd, 0).getDate()
  return {
    dateFrom: `${year}-${String(monthStart).padStart(2, '0')}-01`,
    dateTo:   `${year}-${String(monthEnd).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

const TAX_RATE = 0.03

function buildChartData(transactions: Transaction[]): ChartMonth[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const monthStr = String(month + 1).padStart(2, '0')
    const dateFrom = `${year}-${monthStr}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`
    const income = transactions
      .filter((t) => t.deletedAt === null && t.type === 'INCOME' && t.date >= dateFrom && t.date <= dateTo)
      .reduce((s, t) => s + t.amount, 0)
    return {
      month: new Intl.DateTimeFormat(getIntlLocale(), { month: 'short' }).format(d),
      income,
      tax: Math.round(income * TAX_RATE),
      isCurrent: i === 5,
    }
  })
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const [quarter, setQuarter] = useState('Q1-2026')
  const [showAddModal, setShowAddModal] = useState(false)
  const [fetching, setFetching] = useState(false)

  const { transactions, isLoaded, userId: storeUserId, setTransactions } = useTransactionStore()

  const greeting = getGreeting(t)
  const firstName = user?.fullName?.split(' ')[0] ?? t('dashboard.fallbackName')
  const quarterLabel = getQuarterLabel(quarter, t)

  // Fetch from backend once per user session
  useEffect(() => {
    if (!user?.id) return
    if (isLoaded && storeUserId === user.id) return
    setFetching(true)
    apiFetchTransactions()
      .then((txs) => setTransactions(txs, user.id))
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [user?.id, isLoaded, storeUserId, setTransactions])

  const { dateFrom, dateTo } = parseQuarter(quarter)

  const quarterTxs = useMemo(
    () => transactions.filter((t) => t.deletedAt === null && t.date >= dateFrom && t.date <= dateTo),
    [transactions, dateFrom, dateTo],
  )

  const totalIncome = useMemo(
    () => quarterTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
    [quarterTxs],
  )
  const tax = Math.round(totalIncome * TAX_RATE)
  const chartData = useMemo(() => buildChartData(transactions), [transactions, i18n.language])

  const showEmpty = !fetching && isLoaded && transactions.length === 0

  return (
    <div className="min-h-screen bg-navy px-10 py-10 pb-20 max-lg:px-4 max-lg:py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="font-body text-[15px] text-white-dim">
            {greeting}, {firstName}
          </p>
          <h1 className="font-display text-[28px] text-white mt-1">
            {t('dashboard.title', { quarter: quarterLabel })}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <QuarterSelector value={quarter} onChange={setQuarter} />
          <AddIncomeButton onClick={() => setShowAddModal(true)} />
        </div>
      </div>

      {/* Loading skeleton */}
      {fetching && (
        <div className="grid grid-cols-4 max-lg:grid-cols-2 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[110px] bg-navy-3 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && <EmptyState onAdd={() => setShowAddModal(true)} />}

      {/* Data */}
      {!fetching && !showEmpty && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-4 max-lg:grid-cols-2 gap-5 mb-8">
            <KPICard
              label={t('dashboard.kpi.quarterIncome')}
              value={totalIncome}
              format={formatNumber}
              valueSuffix="₸"
            />
            <KPICard
              label={t('dashboard.kpi.taxDue')}
              value={tax}
              format={formatNumber}
              valueSuffix="₸"
              trend={{ text: t('dashboard.kpi.taxRate'), direction: 'neutral' }}
            />
            <KPICard
              label={t('dashboard.kpi.quarterTransactions')}
              value={quarterTxs.length}
              trend={{ text: t('dashboard.kpi.selectedPeriod'), direction: 'neutral' }}
            />
            <KPICard
              label={t('dashboard.kpi.allTransactions')}
              value={transactions.length}
              trend={{ text: t('dashboard.kpi.allTime'), direction: 'neutral' }}
            />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-[1fr_380px] max-lg:grid-cols-1 gap-6">
            <IncomeChart data={chartData} />
            <div className="flex flex-col gap-5">
              <AIAdvisorCard />
              <DeadlinesCard />
            </div>
          </div>
        </>
      )}

      <AddTransactionModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => setShowAddModal(false)}
      />

      {/* Mobile FAB — quick add income */}
      <FAB onClick={() => setShowAddModal(true)} label={t('dashboard.addTransaction')} />
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
        style={{ background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.15)' }}
      >
        📊
      </div>
      <div className="text-center">
        <h2 className="font-display text-[24px] text-white">{t('dashboard.empty.title')}</h2>
        <p className="font-body text-[15px] text-white-dim mt-2 max-w-[360px]">
          {t('dashboard.empty.text')}
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          to={ROUTES.TRANSACTIONS}
          className="px-5 py-2.5 rounded-lg font-body font-semibold text-[14px] bg-green hover:bg-green-dim text-navy transition-colors duration-150"
        >
          {t('dashboard.empty.upload')}
        </Link>
        <button
          onClick={onAdd}
          className="px-5 py-2.5 rounded-lg font-body font-semibold text-[14px] bg-navy-3 border border-border text-white hover:bg-navy-4 transition-colors duration-150"
        >
          {t('common.actions.addManually')}
        </button>
      </div>
    </div>
  )
}

// ── Quarter selector ───────────────────────────────────────────────────────────
function QuarterSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const label = getQuarterLabel(value, t)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-navy-3 border border-border rounded-lg px-4 py-2.5 font-mono text-[14px] text-white cursor-pointer hover:border-white/20 transition-colors"
      >
        {label}
        <svg
          className={cn('w-4 h-4 text-white-dim transition-transform duration-150', open && 'rotate-180')}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-20 bg-navy-3 border border-border rounded-xl overflow-hidden shadow-xl min-w-[150px]"
            >
              {QUARTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 font-mono text-[13px] transition-colors duration-100',
                    opt.value === value
                      ? 'text-green bg-[rgba(0,232,122,0.08)]'
                      : 'text-white-dim hover:text-white hover:bg-white-ghost',
                  )}
                >
                  {t('common.format.quarter', { quarter: opt.quarter, year: opt.year })}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function AddIncomeButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-2 bg-green hover:bg-green-dim text-navy font-body font-semibold text-[14px] px-5 py-2.5 rounded-lg transition-colors duration-150"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {t('dashboard.addIncome')}
    </motion.button>
  )
}

// ── AI advisor card ────────────────────────────────────────────────────────────
function AIAdvisorCard() {
  const { t } = useTranslation()

  return (
    <div
      className="bg-navy-3 rounded-2xl p-6"
      style={{ border: '1px solid rgba(0,232,122,0.2)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,232,122,0.1)' }}>
          <svg className="w-5 h-5 text-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
            <path d="M7 13h.01M12 13h.01M17 13h.01" />
          </svg>
        </div>
        <span className="font-body font-semibold text-[16px] text-white">{t('dashboard.ai.title')}</span>
      </div>

      <div
        className="mt-4 px-4 py-4 rounded-[0_10px_10px_0]"
        style={{ background: 'rgba(0,232,122,0.05)', borderLeft: '3px solid #00E87A' }}
      >
        <p className="font-body font-semibold text-[14px] text-white">{t('dashboard.ai.headline')}</p>
        <p className="font-body text-[13px] text-white-dim mt-1">
          {t('dashboard.ai.text')}
        </p>
      </div>

      <Link
        to={ROUTES.AI_ADVISOR}
        className="block mt-4 font-body font-medium text-[14px] text-green hover:text-green-dim transition-colors duration-150"
      >
        {t('dashboard.ai.open')}
      </Link>
    </div>
  )
}

// ── Deadlines card ─────────────────────────────────────────────────────────────
function DeadlinesCard() {
  const { t } = useTranslation()

  return (
    <div className="bg-navy-3 border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[18px]">⏰</span>
        <h3 className="font-body font-semibold text-[16px] text-white">{t('dashboard.deadlines.title')}</h3>
      </div>

      <div className="flex flex-col">
        {mockDeadlines.map((dl, i) => {
          const urgency =
            dl.daysUntil < 7
              ? { label: t('common.status.urgent'), color: 'text-red',   bg: 'rgba(255,77,77,0.1)' }
              : dl.daysUntil <= 30
                ? { label: t('common.status.soon'),  color: 'text-amber', bg: 'rgba(255,184,0,0.1)' }
                : { label: t('common.status.ok'),     color: 'text-green', bg: 'rgba(0,232,122,0.1)' }
          const name = t(`dashboard.deadlines.${dl.id}Name`, { defaultValue: dl.name })
          const sub = t(`dashboard.deadlines.${dl.id}Sub`, { defaultValue: dl.sub })
          const month = t(`dashboard.deadlines.${dl.id}Month`, { defaultValue: dl.month })

          return (
            <div
              key={dl.id}
              className={cn(
                'flex items-center gap-4 py-3',
                i < mockDeadlines.length - 1 && 'border-b border-border',
              )}
            >
              <div className="w-12 h-12 bg-navy-4 rounded-xl flex flex-col items-center justify-center shrink-0">
                <span className="font-mono font-medium text-[18px] text-white leading-none">{dl.day}</span>
                <span className="font-mono text-[11px] text-white-dim uppercase mt-0.5">{month}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body font-medium text-[14px] text-white truncate">{name}</p>
                <p className="font-body text-[12px] text-white-dim mt-0.5 truncate">{sub}</p>
              </div>
              <span
                className={cn('font-mono font-medium text-[11px] px-2.5 py-1 rounded-md shrink-0 uppercase tracking-wide', urgency.color)}
                style={{ background: urgency.bg }}
              >
                {urgency.label}
              </span>
            </div>
          )
        })}
      </div>

      <Link
        to={ROUTES.DEADLINES}
        className="block mt-3 font-body font-medium text-[14px] text-green hover:text-green-dim transition-colors duration-150"
      >
        {t('dashboard.deadlines.viewAll')}
      </Link>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getGreeting(t: ReturnType<typeof useTranslation>['t']): string {
  const h = new Date().getHours()
  if (h < 6)  return t('dashboard.greeting.night')
  if (h < 12) return t('dashboard.greeting.morning')
  if (h < 17) return t('dashboard.greeting.day')
  return t('dashboard.greeting.evening')
}

function getQuarterLabel(value: string, t: ReturnType<typeof useTranslation>['t']): string {
  const option = QUARTER_OPTIONS.find((q) => q.value === value)
  return option ? t('common.format.quarter', { quarter: option.quarter, year: option.year }) : value
}
