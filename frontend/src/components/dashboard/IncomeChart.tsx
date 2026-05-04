import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from 'recharts'
import { cn } from '@utils/cn'
import { formatKZT } from '@utils/formatCurrency'
import { getIntlLocale } from '../../i18n'
import type { ChartMonth } from '@mocks/mockData'

interface Props {
  data: ChartMonth[]
}

const TABS = ['Q2', 'Q1', 'YEAR'] as const
type Tab = (typeof TABS)[number]

const TAB_LABEL_KEYS: Record<Tab, string> = {
  Q2: 'dashboard.chart.tabs.q2',
  Q1: 'dashboard.chart.tabs.q1',
  YEAR: 'dashboard.chart.tabs.year',
}

function fmtAxis(n: number) {
  if (n === 0) return '0'
  return new Intl.NumberFormat(getIntlLocale(), {
    notation: 'compact',
    maximumFractionDigits: n >= 1_000_000 ? 1 : 0,
  }).format(n)
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  const { t } = useTranslation()

  if (!active || !payload?.length) return null

  return (
    <div
      className="border border-border rounded-[10px] p-3 px-4"
      style={{
        background: '#1A2A47',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <p className="font-body font-semibold text-[13px] text-white mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[14px] font-mono">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-white-dim text-[12px] mr-1">
            {entry.name === 'income' ? t('dashboard.chart.incomeTooltip') : t('dashboard.chart.taxTooltip')}
          </span>
          <span style={{ color: entry.color }}>{entry.value === 0 ? '—' : formatKZT(entry.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────
export function IncomeChart({ data }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('Q2')

  // Compute average tax rate from non-zero months
  const nonZero = data.filter((d) => d.income > 0)
  const avgRate =
    nonZero.length > 0
      ? (nonZero.reduce((sum, d) => sum + d.tax / d.income, 0) / nonZero.length) * 100
      : 0

  return (
    <div className="bg-navy-3 border border-border rounded-2xl p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h3 className="font-body font-semibold text-[18px] text-white">
          {t('dashboard.chart.title')}
        </h3>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-navy-4 rounded-lg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3.5 py-1.5 rounded-md font-body font-medium text-[13px] transition-all duration-150',
                activeTab === tab
                  ? 'bg-navy-3 text-white'
                  : 'text-white-dim hover:text-white',
              )}
            >
              {t(TAB_LABEL_KEYS[tab])}
            </button>
          ))}
        </div>
      </div>

      {/* Chart — horizontally scrollable on narrow screens */}
      <div className="overflow-x-auto -mx-2 px-2">
        <div className="min-w-[340px]">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E87A" />
              <stop offset="100%" stopColor="#00B85F" />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="rgba(240,244,255,0.1)"
            strokeDasharray="4 4"
          />

          <XAxis
            dataKey="month"
            axisLine={{ stroke: 'rgba(240,244,255,0.1)' }}
            tickLine={false}
            tick={{ fill: 'rgba(240,244,255,0.6)', fontSize: 12, fontFamily: '"IBM Plex Mono"' }}
          />

          <YAxis
            tickFormatter={fmtAxis}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(240,244,255,0.6)', fontSize: 12, fontFamily: '"IBM Plex Mono"' }}
            width={52}
          />

          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(240,244,255,0.04)' }} />

          {/* Income bars */}
          <Bar dataKey="income" name="income" fill="url(#incomeGradient)" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((entry) => (
              <Cell
                key={entry.month}
                fill={entry.income === 0 ? 'rgba(0,232,122,0.15)' : 'url(#incomeGradient)'}
                style={
                  entry.isCurrent
                    ? { filter: 'drop-shadow(0 0 6px rgba(0,232,122,0.35))' }
                    : undefined
                }
              />
            ))}
          </Bar>

          {/* Tax bars */}
          <Bar dataKey="tax" name="tax" fill="#FFB800" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.8}>
            {data.map((entry) => (
              <Cell
                key={entry.month}
                fill={entry.tax === 0 ? 'rgba(255,184,0,0.15)' : '#FFB800'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green" />
          <span className="font-body text-[13px] text-white-dim">{t('dashboard.chart.income')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber" />
          <span className="font-body text-[13px] text-white-dim">{t('dashboard.chart.tax')}</span>
        </div>
      </div>

      {/* Average tax rate */}
      <div className="mt-5 pt-4 border-t border-border">
        <span className="font-body text-[14px] text-white-dim">
          {t('dashboard.chart.averageTaxRate')}{' '}
        </span>
        <span className="font-mono font-medium text-[14px] text-green">
          {avgRate.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}
