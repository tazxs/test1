import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@utils/cn'
import { getIntlLocale } from '@/i18n'

// ── Extended mock data ─────────────────────────────────────────────────────────
interface DeadlineConfig {
  id: string
  year: number
  month: number // 1–12
  day: number
  nameKey: string
  subKey: string
  formTypeKey: string
  declarationFormType?: 'FORM_910'
  amount?: number
}

interface Deadline extends DeadlineConfig {
  daysUntil: number
}

// Kazakhstan is UTC+5 year-round (no DST). Use explicit offset arithmetic so
// the result is correct regardless of the user's system timezone setting.
const ALMATY_OFFSET_MS = 5 * 3_600_000
const MS_PER_DAY       = 86_400_000

function daysUntil(year: number, month: number, day: number): number {
  const todayDay  = Math.floor((Date.now() + ALMATY_OFFSET_MS) / MS_PER_DAY)
  const targetDay = Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY)
  return targetDay - todayDay
}

const DEADLINE_CONFIGS: DeadlineConfig[] = [
  {
    id: 'dl1', year: 2026, month: 3,  day: 25,
    nameKey: 'deadlines.items.dl1.name', subKey: 'deadlines.items.dl1.sub',
    formTypeKey: 'declarations.form.ESP.short', amount: 1 * 4 * 28284,
  },
  {
    id: 'dl2', year: 2026, month: 8,  day: 15,
    nameKey: 'deadlines.items.form910H1Submit.name', subKey: 'deadlines.items.form910H1Submit.sub',
    formTypeKey: 'declarations.form.FORM_910.short', declarationFormType: 'FORM_910',
  },
  {
    id: 'dl3', year: 2026, month: 4,  day: 25,
    nameKey: 'deadlines.items.dl3.name', subKey: 'deadlines.items.dl3.sub',
    formTypeKey: 'declarations.form.ESP.short', amount: 1 * 4 * 28284,
  },
  {
    id: 'dl4', year: 2026, month: 4,  day: 25,
    nameKey: 'deadlines.items.dl4.name', subKey: 'deadlines.items.dl4.sub',
    formTypeKey: 'declarations.form.FORM_910.short', declarationFormType: 'FORM_910', amount: 29820 + 7488,
  },
  {
    id: 'dl5', year: 2026, month: 8,  day: 25,
    nameKey: 'deadlines.items.form910H1Pay.name', subKey: 'deadlines.items.form910H1Pay.sub',
    formTypeKey: 'declarations.form.FORM_910.short', declarationFormType: 'FORM_910',
  },
  {
    id: 'dl6', year: 2027, month: 2, day: 15,
    nameKey: 'deadlines.items.form910H2Submit.name', subKey: 'deadlines.items.form910H2Submit.sub',
    formTypeKey: 'declarations.form.FORM_910.short', declarationFormType: 'FORM_910',
  },
  {
    id: 'dl7', year: 2027, month: 2, day: 25,
    nameKey: 'deadlines.items.form910H2Pay.name', subKey: 'deadlines.items.form910H2Pay.sub',
    formTypeKey: 'declarations.form.FORM_910.short', declarationFormType: 'FORM_910',
  },
]

const DEADLINES: Deadline[] = DEADLINE_CONFIGS.map((c) => ({
  ...c,
  daysUntil: daysUntil(c.year, c.month, c.day),
}))

type UrgencyKey = 'URGENT' | 'SOON' | 'OK'

function getUrgency(days: number): { key: UrgencyKey; labelKey: string; color: string; bg: string } {
  if (days < 7)  return { key: 'URGENT', labelKey: 'common.status.urgent', color: 'text-red',   bg: 'rgba(255,77,77,0.1)'   }
  if (days <= 30) return { key: 'SOON',   labelKey: 'common.status.soon',   color: 'text-amber', bg: 'rgba(255,184,0,0.1)'   }
  return             { key: 'OK',     labelKey: 'common.status.ok',     color: 'text-green', bg: 'rgba(0,232,122,0.1)'  }
}

type Filter = 'ALL' | UrgencyKey

const FILTER_TABS: { id: Filter; labelKey: string }[] = [
  { id: 'ALL',    labelKey: 'deadlines.filters.all' },
  { id: 'URGENT', labelKey: 'deadlines.filters.urgent' },
  { id: 'SOON',   labelKey: 'deadlines.filters.soon' },
  { id: 'OK',     labelKey: 'deadlines.filters.later' },
]

// ── Main page ──────────────────────────────────────────────────────────────────
export function Deadlines() {
  const { t } = useTranslation()
  const [activeFilter, setActiveFilter] = useState<Filter>('ALL')
  const intlLocale = getIntlLocale()
  const moneyFormatter = new Intl.NumberFormat(intlLocale)
  const dateFormatter = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric' })
  const monthFormatter = new Intl.DateTimeFormat(intlLocale, { month: 'short' })

  const filtered = DEADLINES.filter((dl) => {
    if (activeFilter === 'ALL') return true
    return getUrgency(dl.daysUntil).key === activeFilter
  })

  const urgentCount = DEADLINES.filter((d) => getUrgency(d.daysUntil).key === 'URGENT').length
  const soonCount   = DEADLINES.filter((d) => getUrgency(d.daysUntil).key === 'SOON').length

  return (
    <div className="min-h-screen bg-navy px-10 py-10 max-lg:px-4 max-lg:py-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-display text-[28px] text-white">{t('deadlines.title')}</h1>
          <p className="font-body text-[14px] text-white-dim mt-1">
            {t('deadlines.currentAsOf', { date: dateFormatter.format(new Date()) })}
          </p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-4 mb-8">
        <div
          className="rounded-2xl px-5 py-4 border"
          style={{ background: 'rgba(255,77,77,0.06)', borderColor: 'rgba(255,77,77,0.2)' }}
        >
          <p className="font-body text-[13px] text-white-dim">{t('deadlines.summary.urgent')}</p>
          <p className="font-mono font-semibold text-[28px] text-red mt-1">{urgentCount}</p>
        </div>
        <div
          className="rounded-2xl px-5 py-4 border"
          style={{ background: 'rgba(255,184,0,0.06)', borderColor: 'rgba(255,184,0,0.2)' }}
        >
          <p className="font-body text-[13px] text-white-dim">{t('deadlines.summary.soon')}</p>
          <p className="font-mono font-semibold text-[28px] text-amber mt-1">{soonCount}</p>
        </div>
        <div
          className="rounded-2xl px-5 py-4 border"
          style={{ background: 'rgba(0,232,122,0.06)', borderColor: 'rgba(0,232,122,0.15)' }}
        >
          <p className="font-body text-[13px] text-white-dim">{t('deadlines.summary.total')}</p>
          <p className="font-mono font-semibold text-[28px] text-green mt-1">{DEADLINES.length}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="inline-flex gap-1 bg-navy-3 rounded-lg p-1 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id)}
            className={cn(
              'px-5 py-2 rounded-lg font-body font-medium text-[14px] transition-all duration-150',
              activeFilter === tab.id
                ? 'bg-navy-4 text-white'
                : 'text-white-dim hover:text-white',
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Deadline cards */}
      <div className="flex flex-col gap-3">
        {filtered.map((dl, i) => {
          const urgency = getUrgency(dl.daysUntil)

          return (
            <motion.div
              key={dl.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className="bg-navy-3 border border-border rounded-2xl p-5 flex items-center gap-5 max-sm:flex-col max-sm:items-start"
            >
              {/* Date box */}
              <div className="w-16 h-16 bg-navy-4 rounded-2xl flex flex-col items-center justify-center shrink-0">
                <span className="font-mono font-bold text-[22px] text-white leading-none">{dl.day}</span>
                <span className="font-mono text-[11px] text-white-dim uppercase mt-0.5">
                  {monthFormatter.format(new Date(dl.year, dl.month - 1, dl.day)).toLocaleUpperCase(intlLocale)}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-body font-semibold text-[15px] text-white">{t(dl.nameKey)}</p>
                  <span
                    className={cn(
                      'font-mono font-medium text-[10px] px-2 py-0.5 rounded uppercase tracking-wide',
                      urgency.color,
                    )}
                    style={{ background: urgency.bg }}
                  >
                    {t(urgency.labelKey)}
                  </span>
                </div>
                <p className="font-body text-[13px] text-white-dim mt-0.5">{t(dl.subKey)}</p>

                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="font-mono text-[12px] text-white-dim bg-navy-4 px-2 py-0.5 rounded">
                    {t(dl.formTypeKey)}
                  </span>
                  {dl.amount != null && (
                    <span className="font-mono text-[12px] text-amber">
                      {t('common.money.kztApprox', { value: moneyFormatter.format(dl.amount) })}
                    </span>
                  )}
                  {dl.declarationFormType === 'FORM_910' && (
                    <Link
                      to="/declarations?form=FORM_910"
                      className="font-body text-[12px] font-medium text-green hover:text-green-dim transition-colors underline underline-offset-2"
                    >
                      {t('deadlines.actions.createDeclaration')}
                    </Link>
                  )}
                </div>
              </div>

              {/* Days remaining */}
              <div className="text-right shrink-0 max-sm:self-end">
                <p className={cn('font-mono font-bold text-[28px] tabular-nums', urgency.color)}>
                  {dl.daysUntil}
                </p>
                <p className="font-body text-[12px] text-white-dim">
                  {t('deadlines.daysRemaining', { count: dl.daysUntil })}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-display text-[20px] text-white">{t('deadlines.empty.title')}</p>
          <p className="font-body text-[14px] text-white-dim mt-1">{t('deadlines.empty.text')}</p>
        </div>
      )}

      {/* Info block */}
      <div
        className="mt-8 rounded-2xl px-6 py-5"
        style={{ background: 'rgba(0,178,255,0.04)', border: '1px solid rgba(0,178,255,0.12)' }}
      >
        <div className="flex items-start gap-3">
          <span className="text-[20px] mt-0.5">ℹ️</span>
          <div>
            <p className="font-body font-semibold text-[14px] text-white">{t('deadlines.info.title')}</p>
            <p className="font-body text-[13px] text-white-dim mt-1 leading-relaxed">
              {t('deadlines.info.text')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
