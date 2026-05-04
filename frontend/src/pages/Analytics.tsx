import { useMemo, useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { Transaction } from 'nalogai-shared/types/transaction.types'
import { useTransactionStore } from '@store/transactionStore'
import { useAuthStore } from '@store/authStore'
import { apiFetchTransactions } from '@api/transactions'
import { cn } from '@utils/cn'

// ── Category labels & colors ───────────────────────────────────────────────────
const CAT_LABELS: Record<string, string> = {
  SERVICES_INCOME:    'Услуги',
  CONSULTING_INCOME:  'Консалтинг',
  FREELANCE_INCOME:   'Фриланс',
  GOODS_INCOME:       'Товары',
  RENT_INCOME:        'Аренда',
  DIVIDEND_INCOME:    'Дивиденды',
  INTEREST_INCOME:    'Проценты',
  ASSET_SALE_INCOME:  'Продажа актива',
  OTHER_INCOME:       'Прочие доходы',
  OFFICE_EXPENSES:    'Офис',
  EQUIPMENT_EXPENSES: 'Оборудование',
  MARKETING_EXPENSES: 'Маркетинг',
  SALARY_EXPENSES:    'Зарплата',
  TRANSPORT_EXPENSES: 'Транспорт',
  UTILITIES_EXPENSES: 'Коммунальные',
  INSURANCE_EXPENSES: 'Страхование',
  TAX_EXPENSES:       'Налоги',
  BANK_EXPENSES:      'Банк. услуги',
  REPAIR_EXPENSES:    'Ремонт',
  SUBSCRIPTION_EXPENSES: 'Подписки',
  OTHER_EXPENSES:     'Прочие расходы',
  UNCATEGORIZED:      'Без категории',
}

const CAT_COLORS: Record<string, string> = {
  SERVICES_INCOME:    '#00E87A',
  CONSULTING_INCOME:  '#00C8C8',
  FREELANCE_INCOME:   '#00B2FF',
  GOODS_INCOME:       '#A578FF',
  RENT_INCOME:        '#FFA0C8',
  DIVIDEND_INCOME:    '#7BE87A',
  INTEREST_INCOME:    '#5BE8D0',
  ASSET_SALE_INCOME:  '#C8B8FF',
  OTHER_INCOME:       '#78C8A0',
  OFFICE_EXPENSES:    '#FFB800',
  EQUIPMENT_EXPENSES: '#00C8C8',
  MARKETING_EXPENSES: '#FF7850',
  SALARY_EXPENSES:    '#A578FF',
  TRANSPORT_EXPENSES: '#FFA0C8',
  UTILITIES_EXPENSES: '#FFB800',
  INSURANCE_EXPENSES: '#FF9060',
  TAX_EXPENSES:       '#FF6080',
  BANK_EXPENSES:      '#C0A060',
  REPAIR_EXPENSES:    '#80A0C0',
  SUBSCRIPTION_EXPENSES: '#A0C080',
  OTHER_EXPENSES:     '#888',
  UNCATEGORIZED:      '#FF4D4D',
}

type CatEntry = { name: string; value: number; color: string }

function sumByCategory(txs: Transaction[]): CatEntry[] {
  const map = new Map<string, number>()
  for (const t of txs) {
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => ({
      name: CAT_LABELS[cat] ?? cat,
      value: val,
      color: CAT_COLORS[cat] ?? '#888',
    }))
}

// ── Tooltip components ─────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-3 border border-border rounded-xl px-4 py-3 shadow-card">
      {label != null && <p className="font-mono text-[11px] text-white-dim mb-2">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span className="font-body text-[12px]" style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-[12px] text-white tabular-nums">
            {p.value.toLocaleString('ru-KZ')} ₸
          </span>
        </div>
      ))}
    </div>
  )
}

function PieTooltip({
  active, payload, total,
}: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  total: number
}) {
  if (!active || !payload?.length) return null
  const p = payload[0] as { name?: string; value?: number; payload?: CatEntry }
  if (p == null) return null
  const name  = p.payload?.name ?? p.name ?? ''
  const value = p.value ?? 0
  const pct   = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="bg-navy-3 border border-border rounded-xl px-4 py-3 shadow-card">
      <p className="font-body text-[13px] text-white">{name}</p>
      <p className="font-mono text-[13px] text-white-dim mt-1">
        {value.toLocaleString('ru-KZ')} ₸ · {pct}%
      </p>
    </div>
  )
}

// ── UI building blocks ─────────────────────────────────────────────────────────
function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-navy-3 border border-border rounded-2xl px-5 py-4">
      <p className="font-body text-[13px] text-white-dim">{label}</p>
      <p className={cn('font-mono font-semibold text-[22px] mt-1', color ?? 'text-white')}>
        {value}
      </p>
    </div>
  )
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-navy-3 border border-border rounded-2xl p-6', className)}>
      <h3 className="font-body font-semibold text-[16px] text-white mb-5">{title}</h3>
      {children}
    </div>
  )
}

// ── Period tabs ────────────────────────────────────────────────────────────────
type Period = '3M' | '6M' | 'ALL'

const PERIOD_TABS: { id: Period; label: string }[] = [
  { id: '3M',  label: 'Квартал' },
  { id: '6M',  label: '6 месяцев' },
  { id: 'ALL', label: 'Всё время' },
]

function filterByPeriod(txs: Transaction[], period: Period): Transaction[] {
  if (period === 'ALL') return txs
  const months = period === '3M' ? 3 : 6
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString().slice(0, 10)
  return txs.filter((t) => t.date >= cutoff)
}

// ── Monthly chart data ─────────────────────────────────────────────────────────
function buildMonthsData(txs: Transaction[]) {
  const map = new Map<string, { income: number; expense: number }>()
  for (const t of txs) {
    const key = t.date.slice(0, 7) // YYYY-MM
    const entry = map.get(key) ?? { income: 0, expense: 0 }
    if (t.type === 'INCOME') entry.income += t.amount
    else entry.expense += t.amount
    map.set(key, entry)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [year, month] = key.split('-') as [string, string]
      const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })
      const profit = val.income - val.expense
      return {
        month: label,
        income: val.income,
        expense: val.expense,
        tax: Math.round(Math.max(0, profit) * 0.03),
      }
    })
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="min-h-screen bg-navy px-10 py-10 max-lg:px-4 max-lg:py-6 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 text-white-dim mb-6">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="8" y="16" width="48" height="36" rx="4" />
          <path d="M22 28 L42 28 M22 36 L34 36" />
        </svg>
      </div>
      <h2 className="font-display text-[24px] text-white">Нет данных для анализа</h2>
      <p className="font-body text-[16px] text-white-dim mt-2 max-w-[400px]">
        Добавьте транзакции или загрузите банковскую выписку — аналитика появится автоматически
      </p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function Analytics() {
  const [period, setPeriod] = useState<Period>('ALL')
  const { transactions, isLoaded, userId: storeUserId, setTransactions } = useTransactionStore()
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user?.id) return
    if (isLoaded && storeUserId === user.id) return
    apiFetchTransactions()
      .then((txs) => setTransactions(txs, user.id))
      .catch(console.error)
  }, [user?.id, isLoaded, storeUserId, setTransactions])

  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])

  const totalIncome  = useMemo(() => filtered.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0), [filtered])
  const totalExpense = useMemo(() => filtered.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0), [filtered])
  const netProfit    = totalIncome - totalExpense
  const taxEstimate  = Math.round(Math.max(0, netProfit) * 0.03)
  const savingsRate  = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0

  const monthsData       = useMemo(() => buildMonthsData(filtered), [filtered])
  const incomeByCategory = useMemo(() => sumByCategory(filtered.filter((t) => t.type === 'INCOME')), [filtered])
  const expenseByCategory= useMemo(() => sumByCategory(filtered.filter((t) => t.type === 'EXPENSE')), [filtered])

  const avgMonthlyTax  = monthsData.length > 0
    ? Math.round(monthsData.reduce((s, m) => s + m.tax, 0) / monthsData.length)
    : 0
  const avgTaxRate     = monthsData.reduce((s, m) => s + m.income, 0) > 0
    ? (monthsData.reduce((s, m) => s + m.tax, 0) / monthsData.reduce((s, m) => s + m.income, 0) * 100).toFixed(1)
    : '—'

  if (isLoaded && transactions.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="min-h-screen bg-navy px-10 py-10 max-lg:px-4 max-lg:py-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-display text-[28px] text-white">Аналитика</h1>
          <p className="font-body text-[14px] text-white-dim mt-1">
            {filtered.length > 0
              ? `${filtered.length} транзакций за выбранный период`
              : 'Нет транзакций за выбранный период'}
          </p>
        </div>

        {/* Period selector */}
        <div className="inline-flex gap-1 bg-navy-3 rounded-lg p-1">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={cn(
                'px-4 py-2 rounded-lg font-body font-medium text-[13px] transition-all duration-150',
                period === tab.id ? 'bg-navy-4 text-white' : 'text-white-dim hover:text-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4 mb-8">
        <KPI label="Доходы" value={`${totalIncome.toLocaleString('ru-KZ')} ₸`} color="text-green" />
        <KPI label="Расходы" value={`${totalExpense.toLocaleString('ru-KZ')} ₸`} color="text-red" />
        <KPI label="Чистая прибыль" value={`${netProfit.toLocaleString('ru-KZ')} ₸`} color="text-white" />
        <KPI label="Налог (оценка)" value={`${taxEstimate.toLocaleString('ru-KZ')} ₸`} color="text-amber" />
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-white-dim font-body text-[15px]">
          Нет транзакций за выбранный период
        </div>
      ) : (
        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-6">

          {/* Income vs Expense bar chart */}
          <ChartCard title="Доходы и расходы по месяцам" className="col-span-2 max-lg:col-span-1">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthsData} barGap={4} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="rgba(240,244,255,0.06)" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'rgba(240,244,255,0.5)', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'rgba(240,244,255,0.5)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}к`}
                  width={42}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(240,244,255,0.04)' }} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: 'rgba(240,244,255,0.6)', fontSize: 12 }}>{value}</span>
                  )}
                />
                <Bar dataKey="income" name="Доход" fill="#00E87A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Расход" fill="rgba(255,77,77,0.7)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Income by category — pie */}
          {incomeByCategory.length > 0 && (
            <ChartCard title="Доходы по категориям">
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={incomeByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {incomeByCategory.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={(props) => <PieTooltip {...props} total={totalIncome} />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  {incomeByCategory.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
                      <span className="font-body text-[12px] text-white-dim truncate">{entry.name}</span>
                      <span className="font-mono text-[12px] text-white ml-auto tabular-nums shrink-0">
                        {totalIncome > 0 ? Math.round((entry.value / totalIncome) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          )}

          {/* Expenses by category */}
          {expenseByCategory.length > 0 && (
            <ChartCard title="Расходы по категориям">
              <div className="flex flex-col gap-2">
                {expenseByCategory.map((entry) => {
                  const pct = totalExpense > 0 ? Math.round((entry.value / totalExpense) * 100) : 0
                  return (
                    <div key={entry.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-body text-[13px] text-white-dim">{entry.name}</span>
                        <span className="font-mono text-[12px] text-white tabular-nums">
                          {entry.value.toLocaleString('ru-KZ')} ₸
                        </span>
                      </div>
                      <div className="h-1.5 bg-navy-4 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: entry.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </ChartCard>
          )}

          {/* Tax line chart */}
          <ChartCard title="Налог по месяцам" className="col-span-2 max-lg:col-span-1">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthsData}>
                <CartesianGrid vertical={false} stroke="rgba(240,244,255,0.06)" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'rgba(240,244,255,0.5)', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'rgba(240,244,255,0.5)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}к`}
                  width={42}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(240,244,255,0.1)' }} />
                <Line
                  dataKey="tax"
                  name="Налог"
                  stroke="#FFB800"
                  strokeWidth={2}
                  dot={{ fill: '#FFB800', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Tax efficiency footer */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border flex-wrap">
              <div>
                <p className="font-body text-[12px] text-white-dim">Среднемесячный налог</p>
                <p className="font-mono font-medium text-[15px] text-amber">
                  {avgMonthlyTax.toLocaleString('ru-KZ')} ₸
                </p>
              </div>
              <div>
                <p className="font-body text-[12px] text-white-dim">Средняя ставка</p>
                <p className="font-mono font-medium text-[15px] text-white">{avgTaxRate}%</p>
              </div>
              <div>
                <p className="font-body text-[12px] text-white-dim">Рентабельность</p>
                <p className="font-mono font-medium text-[15px] text-green">{savingsRate}%</p>
              </div>
            </div>
          </ChartCard>

        </div>
      )}
    </div>
  )
}
