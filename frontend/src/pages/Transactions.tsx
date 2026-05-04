import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Transaction, TransactionSource, TransactionType } from 'nalogai-shared/types/transaction.types'
import { CategoryBadge } from '@components/transactions/CategoryBadge'
import { AddTransactionModal } from '@components/transactions/AddTransactionModal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { FAB } from '@components/ui/FAB'
import { useTransactionStore } from '@store/transactionStore'
import { useAuthStore } from '@store/authStore'
import { apiFetchTransactions } from '@api/transactions'
import { ROUTES } from '@lib/constants'
import { cn } from '@utils/cn'
import { formatKZT } from '@utils/formatCurrency'
import { formatDate } from '@utils/formatDate'

const PAGE_SIZE = 50

type FilterTab = 'ALL' | TransactionType | 'UNCATEGORIZED'

const FILTER_TABS: { id: FilterTab; labelKey: string }[] = [
  { id: 'ALL',          labelKey: 'transactions.tabs.all' },
  { id: 'INCOME',       labelKey: 'transactions.tabs.income' },
  { id: 'EXPENSE',      labelKey: 'transactions.tabs.expense' },
  { id: 'UNCATEGORIZED', labelKey: 'transactions.tabs.uncategorized' },
]

function fmtAmount(tx: Transaction) {
  const prefix = tx.type === 'INCOME' ? '+' : '−'
  return `${prefix}${formatKZT(tx.amount)}`
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function Transactions() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { transactions, isLoaded, userId: storeUserId, setTransactions } = useTransactionStore()
  const { user } = useAuthStore()
  const [isSyncing, setIsSyncing] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const navigate = useNavigate()

  // Load transactions from backend if not yet loaded for this user
  useEffect(() => {
    if (!user?.id) return
    if (isLoaded && storeUserId === user.id) return
    if (loadError) return // don't retry after a hard failure
    apiFetchTransactions()
      .then((txs) => {
        setTransactions(txs, user.id)
        setLoadError(false)
      })
      .catch((err) => {
        console.error('Failed to load transactions:', err)
        setLoadError(true)
      })
  }, [user?.id, isLoaded, storeUserId, setTransactions, loadError])

  const uncategorizedCount = transactions.filter((t) => t.category === 'UNCATEGORIZED').length

  const filtered = useMemo(() => {
    let result = transactions
    if (activeTab === 'INCOME' || activeTab === 'EXPENSE') {
      result = result.filter((t) => t.type === activeTab)
    } else if (activeTab === 'UNCATEGORIZED') {
      result = result.filter((t) => t.category === 'UNCATEGORIZED')
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((t) => t.description.toLowerCase().includes(q))
    }
    return result
  }, [transactions, activeTab, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab)
    setPage(1)
  }

  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
  }

  async function handleSync() {
    setIsSyncing(true)
    setIsPulling(true)
    await new Promise((r) => setTimeout(r, 1200))
    setIsSyncing(false)
    setIsPulling(false)
  }

  return (
    <div className="min-h-screen bg-navy px-10 py-10 max-lg:px-4 max-lg:py-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="font-display text-[28px] text-white">{t('transactions.title')}</h1>

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder={t('transactions.search')}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-[280px] max-sm:w-full"
            leftIcon={<SearchIcon />}
          />
          <Button
            variant="secondary"
            size="md"
            onClick={() => void handleSync()}
            loading={isSyncing}
          >
            <span className={cn('mr-2', isSyncing && 'animate-spin')}>🔄</span>
            {t('transactions.sync')}
          </Button>
          <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
            + {t('common.actions.add')}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="inline-flex gap-1 bg-navy-3 rounded-lg p-1 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'relative px-5 py-2 rounded-lg font-body font-medium text-[14px] transition-all duration-150',
              activeTab === tab.id
                ? 'bg-navy-4 text-white'
                : 'text-white-dim hover:text-white',
            )}
          >
            {t(tab.labelKey)}
            {tab.id === 'UNCATEGORIZED' && uncategorizedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red rounded-full font-mono text-[10px] text-white flex items-center justify-center">
                {uncategorizedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {paginated.length === 0 ? (
        <EmptyState
          onAdd={() => setShowAddModal(true)}
          onConnectBank={() => navigate(`${ROUTES.SETTINGS}?tab=banks`)}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-navy-3 border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-body font-medium text-[13px] text-white-dim w-[110px]">
                    {t('transactions.table.date')}
                  </th>
                  <th className="px-4 py-3 text-left font-body font-medium text-[13px] text-white-dim">
                    {t('transactions.table.description')}
                  </th>
                  <th className="px-4 py-3 text-left font-body font-medium text-[13px] text-white-dim w-[160px]">
                    {t('transactions.table.category')}
                  </th>
                  <th className="px-4 py-3 text-right font-body font-medium text-[13px] text-white-dim w-[150px]">
                    {t('transactions.table.amount')}
                  </th>
                  <th className="px-4 py-3 text-left font-body font-medium text-[13px] text-white-dim w-[90px]">
                    {t('transactions.table.source')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {paginated.map((tx, i) => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-border last:border-0 hover:bg-white-ghost transition-colors duration-100"
                    >
                      <td className="px-4 py-4 font-mono text-[13px] text-white-dim whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-4 font-body text-[14px] text-white">
                        {tx.description}
                      </td>
                      <td className="px-4 py-4">
                        <CategoryBadge category={tx.category} />
                      </td>
                      <td className={cn(
                        'px-4 py-4 font-mono font-medium text-[14px] text-right tabular-nums',
                        tx.type === 'INCOME' ? 'text-green' : 'text-red',
                      )}>
                        {fmtAmount(tx)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-[11px] text-white-dim bg-navy-4 px-2 py-1 rounded-md">
                          {getSourceLabel(tx.source, t)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pull-to-refresh indicator — mobile only */}
          <AnimatePresence>
            {isPulling && (
              <motion.div
                key="ptr"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 40 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden flex items-center justify-center gap-2 overflow-hidden"
              >
                <motion.svg
                  className="w-4 h-4 text-green"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </motion.svg>
                <span className="font-body text-[13px] text-white-dim">{t('transactions.refreshing')}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile card list */}
          <div className="flex flex-col gap-2 md:hidden">
            {paginated.map((tx) => (
              <div key={tx.id} className="bg-navy-3 border border-border rounded-[14px] p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-body font-medium text-[15px] text-white truncate">{tx.description}</p>
                  <span className={cn(
                    'font-mono font-medium text-[15px] shrink-0',
                    tx.type === 'INCOME' ? 'text-green' : 'text-red',
                  )}>
                    {fmtAmount(tx)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-[13px] text-white-dim">{formatDate(tx.date)}</span>
                    <CategoryBadge category={tx.category} size="sm" />
                  </div>
                  <span className="font-mono text-[11px] text-white-dim bg-navy-4 px-2 py-0.5 rounded">
                    {getSourceLabel(tx.source, t)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Mobile FAB */}
      <FAB onClick={() => setShowAddModal(true)} label={t('dashboard.addTransaction')} />

      {/* Add transaction modal */}
      <AddTransactionModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => setShowAddModal(false)}
      />
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────────
function Pagination({
  page, totalPages, total, pageSize, onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (p: number) => void
}) {
  const { t } = useTranslation()
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1)

  return (
    <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
      <p className="font-body text-[14px] text-white-dim">
        {t('transactions.pagination', { from, to, total })}
      </p>
      <div className="flex items-center gap-1">
        <PageButton label="←" disabled={page === 1} onClick={() => onPageChange(page - 1)} />
        {pages.map((p) => (
          <PageButton key={p} label={String(p)} active={p === page} onClick={() => onPageChange(p)} />
        ))}
        <PageButton label="→" disabled={page === totalPages} onClick={() => onPageChange(page + 1)} />
      </div>
    </div>
  )
}

function PageButton({
  label, active, disabled, onClick,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-9 h-9 rounded-lg font-body text-[14px] transition-all duration-150',
        active
          ? 'bg-green text-navy font-semibold'
          : disabled
            ? 'text-white/20 cursor-not-allowed'
            : 'bg-navy-3 text-white-dim hover:bg-white-ghost hover:text-white',
      )}
    >
      {label}
    </button>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ onAdd, onConnectBank }: { onAdd: () => void; onConnectBank: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 text-white-dim mb-6">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="8" y="20" width="36" height="28" rx="4" />
          <path d="M24 20V14a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H44" />
          <line x1="16" y1="32" x2="28" y2="32" />
          <line x1="16" y1="38" x2="24" y2="38" />
        </svg>
      </div>
      <h2 className="font-display text-[24px] text-white">{t('transactions.empty.title')}</h2>
      <p className="font-body text-[16px] text-white-dim mt-2 max-w-[400px]">
        {t('transactions.empty.text')}
      </p>
      <div className="flex items-center gap-3 mt-6">
        <Button variant="primary" size="md" onClick={onConnectBank}>{t('transactions.empty.connectBank')}</Button>
        <Button variant="ghost" size="md" onClick={onAdd}>{t('common.actions.addManually')}</Button>
      </div>
    </div>
  )
}

const SOURCE_LABEL_KEYS: Record<TransactionSource, string> = {
  MANUAL: 'transactions.source.manual',
  KASPI: 'transactions.source.kaspi',
  HALYK: 'transactions.source.halyk',
  FORTE: 'transactions.source.forte',
  OTHER_BANK: 'transactions.source.otherBank',
}

function getSourceLabel(source: TransactionSource, t: ReturnType<typeof useTranslation>['t']): string {
  return t(SOURCE_LABEL_KEYS[source], { defaultValue: source })
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
