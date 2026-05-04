import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { DeclarationFormType, DeclarationStatus } from 'nalogai-shared/types/declaration.types'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { useDeclarationStore } from '@store/declarationStore'
import { cn } from '@utils/cn'
import { getIntlLocale } from '@/i18n'
import { toast } from '@store/notificationStore'

const STATUS_STYLE: Record<DeclarationStatus, { bg: string; color: string }> = {
  DRAFT:     { bg: 'rgba(240,244,255,0.08)', color: 'rgba(240,244,255,0.6)' },
  READY:     { bg: 'rgba(255,184,0,0.1)',    color: '#FFB800' },
  SUBMITTED: { bg: 'rgba(0,178,255,0.1)',    color: '#00B2FF' },
  ACCEPTED:  { bg: 'rgba(0,232,122,0.1)',    color: '#00E87A' },
  REJECTED:  { bg: 'rgba(255,77,77,0.1)',    color: '#FF4D4D' },
}

function StatusBadge({ status }: { status: DeclarationStatus }) {
  const { t } = useTranslation()
  const s = STATUS_STYLE[status]
  return (
    <span
      className="inline-flex items-center font-mono font-medium text-[11px] px-2.5 py-1 rounded-md uppercase tracking-wide whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {t(`declarations.status.${status}`)}
    </span>
  )
}

interface PeriodOption {
  value: string
  labelKey: string
  periodType: 'QUARTER' | 'YEAR' | 'MONTH'
}

const PERIOD_OPTIONS_BY_FORM: Record<DeclarationFormType, PeriodOption[]> = {
  FORM_910: [
    { value: '2026-Q1', labelKey: 'declarations.periodOptions.2026H1', periodType: 'QUARTER' },
    { value: '2025-Q3', labelKey: 'declarations.periodOptions.2025H2', periodType: 'QUARTER' },
    { value: '2025-Q1', labelKey: 'declarations.periodOptions.2025H1', periodType: 'QUARTER' },
    { value: '2024-Q3', labelKey: 'declarations.periodOptions.2024H2', periodType: 'QUARTER' },
  ],
  FORM_200: [
    { value: '2025', labelKey: 'declarations.periodOptions.2025Year', periodType: 'YEAR' },
    { value: '2024', labelKey: 'declarations.periodOptions.2024Year', periodType: 'YEAR' },
    { value: '2023', labelKey: 'declarations.periodOptions.2023Year', periodType: 'YEAR' },
  ],
  FORM_912: [
    { value: '2026-Q1', labelKey: 'declarations.periodOptions.2026Q1', periodType: 'QUARTER' },
    { value: '2025-Q4', labelKey: 'declarations.periodOptions.2025Q4', periodType: 'QUARTER' },
    { value: '2025-Q3', labelKey: 'declarations.periodOptions.2025Q3', periodType: 'QUARTER' },
    { value: '2025-Q2', labelKey: 'declarations.periodOptions.2025Q2', periodType: 'QUARTER' },
    { value: '2025-Q1', labelKey: 'declarations.periodOptions.2025Q1', periodType: 'QUARTER' },
  ],
  ESP: [
    { value: '2026-Q1', labelKey: 'declarations.periodOptions.2026Q1Short', periodType: 'QUARTER' },
    { value: '2025-Q4', labelKey: 'declarations.periodOptions.2025Q4Short', periodType: 'QUARTER' },
    { value: '2025-Q3', labelKey: 'declarations.periodOptions.2025Q3Short', periodType: 'QUARTER' },
    { value: '2025-Q2', labelKey: 'declarations.periodOptions.2025Q2Short', periodType: 'QUARTER' },
    { value: '2025-Q1', labelKey: 'declarations.periodOptions.2025Q1Short', periodType: 'QUARTER' },
  ],
}

const FORM_TYPES: DeclarationFormType[] = ['FORM_910', 'FORM_912', 'FORM_200', 'ESP']

function CreateDeclarationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { createDeclaration } = useDeclarationStore()
  const [formType, setFormType] = useState<DeclarationFormType>('FORM_910')
  const periodOptions = PERIOD_OPTIONS_BY_FORM[formType]
  const [period, setPeriod] = useState(periodOptions[0]?.value ?? '2026-Q1')
  const [loading, setLoading] = useState(false)

  function handleFormTypeChange(ft: DeclarationFormType) {
    setFormType(ft)
    setPeriod(PERIOD_OPTIONS_BY_FORM[ft][0]?.value ?? '2026-Q1')
  }

  async function handleCreate() {
    if (formType === 'ESP') {
      toast.error(t('declarations.toast.espViaMobile'))
      return
    }
    const selectedPeriodMeta = PERIOD_OPTIONS_BY_FORM[formType].find((o) => o.value === period)
    setLoading(true)
    try {
      await createDeclaration({
        period,
        periodType: selectedPeriodMeta?.periodType ?? 'QUARTER',
        formType,
      })
      toast.success(t('declarations.toast.created'))
      onClose()
    } catch {
      toast.error(t('declarations.toast.createError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('declarations.create.title')}>
      <div className="flex flex-col gap-5 mt-2">
        <div>
          <label className="block font-body text-[13px] text-white-dim mb-1.5">
            {t('declarations.create.formType')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FORM_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleFormTypeChange(type)}
                className={cn(
                  'text-left px-3 py-3 rounded-xl border transition-all duration-150',
                  formType === type
                    ? 'border-green bg-[rgba(0,232,122,0.08)]'
                    : 'border-border bg-navy-4 hover:border-white/20',
                )}
              >
                <p className={cn(
                  'font-body font-semibold text-[13px]',
                  formType === type ? 'text-green' : 'text-white',
                )}>
                  {t(`declarations.form.${type}.short`)}
                </p>
                <p className="font-body text-[11px] text-white-dim mt-0.5">
                  {t(`declarations.form.${type}.desc`)}
                </p>
                {t(`declarations.form.${type}.note`, { defaultValue: '' }) && (
                  <p className="font-body text-[10px] text-green/60 mt-0.5">
                    {t(`declarations.form.${type}.note`)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {formType !== 'ESP' && (
          <div>
            <label className="block font-body text-[13px] text-white-dim mb-1.5">
              {t('declarations.create.period')}
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full bg-navy-4 border border-border rounded-lg px-3 py-2.5 font-body text-[14px] text-white focus:outline-none focus:border-green transition-colors"
            >
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" size="md" className="flex-1" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="flex-1"
            loading={loading}
            onClick={() => void handleCreate()}
          >
            {t('declarations.create.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function Declarations() {
  const { t } = useTranslation()
  const { declarations, loading, initialized, fetchDeclarations } = useDeclarationStore()
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (!initialized) void fetchDeclarations()
  }, [initialized, fetchDeclarations])

  const money = (value: number) => new Intl.NumberFormat(getIntlLocale()).format(value)
  const countText = loading ? t('dashboard.loading') : t('declarations.count', { count: declarations.length })

  return (
    <div className="min-h-screen bg-navy px-10 py-10 max-lg:px-4 max-lg:py-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-[28px] text-white">{t('declarations.title')}</h1>
          <p className="font-body text-[14px] text-white-dim mt-1">{countText}</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
          {t('declarations.actions.create')}
        </Button>
      </div>

      <div className="grid grid-cols-3 max-lg:grid-cols-1 gap-4 mb-8">
        <SummaryCard
          label={t('declarations.summary.ready')}
          value={declarations.filter((d) => d.status === 'READY').length}
          color="#FFB800"
          bg="rgba(255,184,0,0.08)"
        />
        <SummaryCard
          label={t('declarations.summary.accepted')}
          value={declarations.filter((d) => d.status === 'ACCEPTED').length}
          color="#00E87A"
          bg="rgba(0,232,122,0.08)"
        />
        <SummaryCard
          label={t('declarations.summary.aiSavings')}
          value={t('common.money.kzt', {
            value: money(declarations.reduce((s, d) => s + (d.calculation?.aiOptimizedSavings ?? 0), 0)),
          })}
          color="#A578FF"
          bg="rgba(165,120,255,0.08)"
        />
      </div>

      {loading && declarations.length === 0 ? (
        <LoadingState />
      ) : declarations.length === 0 ? (
        <EmptyState onAdd={() => setShowCreateModal(true)} />
      ) : (
        <>
          <div className="hidden md:block bg-navy-3 border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <TableHead>{t('declarations.table.period')}</TableHead>
                  <TableHead>{t('declarations.table.form')}</TableHead>
                  <TableHead>{t('declarations.table.status')}</TableHead>
                  <TableHead align="right">{t('declarations.table.tax')}</TableHead>
                  <TableHead align="right">{t('declarations.table.aiSavings')}</TableHead>
                  <TableHead align="right">{t('declarations.table.actions')}</TableHead>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {declarations.map((decl, i) => (
                    <motion.tr
                      key={decl.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-border last:border-0 hover:bg-white-ghost transition-colors duration-100"
                    >
                      <td className="px-5 py-4 font-mono font-medium text-[14px] text-white">
                        {formatDeclarationPeriod(decl.period, decl.formType, t)}
                      </td>
                      <td className="px-5 py-4 font-body text-[13px] text-white-dim">
                        {t(`declarations.form.${decl.formType}.label`, { defaultValue: decl.formType })}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={decl.status} />
                      </td>
                      <td className="px-5 py-4 font-mono text-[14px] text-white text-right tabular-nums">
                        {decl.calculation
                          ? t('common.money.kzt', { value: money(decl.calculation.totalTaxBurden) })
                          : <span className="text-white-dim">{t('common.emptyDash')}</span>
                        }
                      </td>
                      <td className="px-5 py-4 font-mono text-[14px] text-green text-right tabular-nums">
                        {decl.calculation?.aiOptimizedSavings
                          ? t('common.money.kztPositive', { value: money(decl.calculation.aiOptimizedSavings) })
                          : <span className="text-white-dim">{t('common.emptyDash')}</span>
                        }
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/declarations/${decl.id}`}
                          className="font-body font-medium text-[13px] text-green hover:text-green-dim transition-colors"
                        >
                          {t('declarations.actions.open')}
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {declarations.map((decl) => (
              <Link
                key={decl.id}
                to={`/declarations/${decl.id}`}
                className="block bg-navy-3 border border-border rounded-[14px] p-4 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-[15px] text-white">
                      {formatDeclarationPeriod(decl.period, decl.formType, t)}
                    </p>
                    <p className="font-body text-[12px] text-white-dim mt-0.5">
                      {t(`declarations.form.${decl.formType}.label`, { defaultValue: decl.formType })}
                    </p>
                  </div>
                  <StatusBadge status={decl.status} />
                </div>
                {decl.calculation != null && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <Metric label={t('declarations.table.tax')} value={t('common.money.kzt', { value: money(decl.calculation.totalTaxBurden) })} />
                    <Metric label={t('declarations.table.aiSavings')} value={t('common.money.kztPositive', { value: money(decl.calculation.aiOptimizedSavings) })} positive />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      <CreateDeclarationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}

function SummaryCard({
  label, value, color, bg,
}: {
  label: string
  value: string | number
  color: string
  bg: string
}) {
  return (
    <div className="rounded-2xl px-5 py-4 border" style={{ background: bg, borderColor: `${color}20` }}>
      <p className="font-body text-[13px] text-white-dim">{label}</p>
      <p className="font-mono font-semibold text-[22px] mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

function TableHead({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={cn('px-5 py-3 font-body font-medium text-[13px] text-white-dim', align === 'right' ? 'text-right' : 'text-left')}>
      {children}
    </th>
  )
}

function Metric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="font-body text-[11px] text-white-dim">{label}</p>
      <p className={cn('font-mono text-[13px] tabular-nums', positive ? 'text-green' : 'text-white')}>{value}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="bg-navy-3 border border-border rounded-2xl overflow-hidden">
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-5 py-4 border-b border-border last:border-0 flex items-center gap-4">
          <div className="h-4 w-20 rounded bg-white-ghost animate-pulse" />
          <div className="h-4 w-32 rounded bg-white-ghost animate-pulse" />
          <div className="h-6 w-16 rounded-md bg-white-ghost animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 text-white-dim mb-6">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="10" y="8" width="38" height="48" rx="4" />
          <line x1="20" y1="24" x2="44" y2="24" />
          <line x1="20" y1="32" x2="44" y2="32" />
          <line x1="20" y1="40" x2="34" y2="40" />
          <circle cx="48" cy="48" r="10" fill="none" />
          <line x1="48" y1="44" x2="48" y2="52" />
          <line x1="44" y1="48" x2="52" y2="48" />
        </svg>
      </div>
      <h2 className="font-display text-[24px] text-white">{t('declarations.empty.title')}</h2>
      <p className="font-body text-[16px] text-white-dim mt-2 max-w-[400px]">
        {t('declarations.empty.text')}
      </p>
      <Button variant="primary" size="md" className="mt-6" onClick={onAdd}>
        {t('declarations.actions.create')}
      </Button>
    </div>
  )
}

function formatDeclarationPeriod(period: string, formType: string, t: TFunction): string {
  if (formType === 'FORM_910') {
    if (period.endsWith('-Q1') || period.endsWith('-Q2')) return t(`declarations.periodOptions.${period.slice(0, 4)}H1`, { defaultValue: period })
    if (period.endsWith('-Q3') || period.endsWith('-Q4')) return t(`declarations.periodOptions.${period.slice(0, 4)}H2`, { defaultValue: period })
  }
  if (/^\d{4}$/.test(period)) return t(`declarations.periodOptions.${period}Year`, { defaultValue: period })
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period)
  if (quarter) return t(`declarations.periodOptions.${quarter[1]}Q${quarter[2]}Short`, { defaultValue: period })
  return period
}
