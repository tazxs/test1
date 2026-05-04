import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { Declaration, DeclarationStatus } from 'nalogai-shared/types/declaration.types'
import { Button } from '@components/ui/Button'
import { EGovSigningModal } from '@components/declarations/EGovSigningModal'
import { useDeclarationStore } from '@store/declarationStore'
import { downloadDeclarationPdfApi, getDeclarationApi } from '@api/declarations.api'
import { cn } from '@utils/cn'
import { toast } from '@store/notificationStore'
import { getIntlLocale } from '@/i18n'

// ── Status tracker ─────────────────────────────────────────────────────────────
const STATUS_STEPS: DeclarationStatus[] = ['DRAFT', 'READY', 'SUBMITTED', 'ACCEPTED']

const STEP_META: Record<DeclarationStatus, { icon: string; descKey: string }> = {
  DRAFT:     { icon: '✏️', descKey: 'declarations.detail.statusSteps.DRAFT' },
  READY:     { icon: '✅', descKey: 'declarations.detail.statusSteps.READY' },
  SUBMITTED: { icon: '📤', descKey: 'declarations.detail.statusSteps.SUBMITTED' },
  ACCEPTED:  { icon: '🎉', descKey: 'declarations.detail.statusSteps.ACCEPTED' },
  REJECTED:  { icon: '❌', descKey: 'declarations.detail.statusSteps.REJECTED' },
}

function statusIndex(s: DeclarationStatus): number {
  const i = STATUS_STEPS.indexOf(s)
  return i === -1 ? STATUS_STEPS.length : i
}

function StatusTracker({ status }: { status: DeclarationStatus }) {
  const { t } = useTranslation()
  const currentIdx = statusIndex(status)
  const isRejected = status === 'REJECTED'

  return (
    <div className="flex flex-col gap-0">
      {STATUS_STEPS.map((step, i) => {
        const done    = currentIdx > i
        const active  = currentIdx === i && !isRejected
        const pending = currentIdx < i

        return (
          <div key={step} className="flex items-start gap-3">
            {/* Connector column */}
            <div className="flex flex-col items-center w-8 shrink-0">
              {/* Circle */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-all duration-300',
                  done   ? 'bg-green text-navy'     :
                  active ? 'bg-[rgba(0,232,122,0.15)] border-2 border-green text-green' :
                           'bg-navy-4 text-white-dim',
                )}
              >
                {done ? '✓' : STEP_META[step].icon}
              </div>
              {/* Line */}
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 my-1 min-h-[20px] transition-all duration-300',
                    done ? 'bg-green' : 'bg-border',
                  )}
                />
              )}
            </div>

            {/* Text */}
            <div className={cn('pb-5', i === STATUS_STEPS.length - 1 && 'pb-0')}>
              <p className={cn(
                'font-body font-semibold text-[14px]',
                done || active ? 'text-white' : 'text-white-dim',
              )}>
                {t(`declarations.status.${step}`)}
              </p>
              <p className="font-body text-[12px] text-white-dim mt-0.5 leading-relaxed">
                {active || pending ? t(STEP_META[step].descKey) : ''}
              </p>
            </div>
          </div>
        )
      })}

      {isRejected && (
        <div className="flex items-start gap-3 mt-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(255,77,77,0.1)] text-[14px]">
            {STEP_META.REJECTED.icon}
          </div>
          <div>
            <p className="font-body font-semibold text-[14px] text-red">
              {t('declarations.status.REJECTED')}
            </p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">{t(STEP_META.REJECTED.descKey)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calculation breakdown ──────────────────────────────────────────────────────
function CalculationPanel({
  decl,
  onCalculate,
}: {
  decl: Declaration
  onCalculate: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [calculating, setCalculating] = useState(false)
  const calc = decl.calculation
  const intlLocale = getIntlLocale()
  const moneyFormatter = new Intl.NumberFormat(intlLocale)

  async function handleCalculate() {
    setCalculating(true)
    try {
      await onCalculate()
    } finally {
      setCalculating(false)
    }
  }

  if (calc == null) {
    return (
      <div className="bg-navy-3 border border-border rounded-2xl p-6 flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-navy-4 flex items-center justify-center text-2xl mb-3">
          🧮
        </div>
        <p className="font-body font-medium text-[16px] text-white">{t('declarations.detail.calculation.emptyTitle')}</p>
        <p className="font-body text-[14px] text-white-dim mt-1 max-w-[300px]">
          {t('declarations.detail.calculation.emptyText')}
        </p>
        <Button
          variant="primary"
          size="md"
          className="mt-5"
          loading={calculating}
          onClick={() => void handleCalculate()}
        >
          {t('declarations.detail.calculation.calculate')}
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-navy-3 border border-border rounded-2xl overflow-hidden">
      {/* Title */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-body font-semibold text-[18px] text-white">{t('declarations.detail.calculation.title')}</h2>
        <p className="font-body text-[13px] text-white-dim mt-0.5">
          {t('declarations.detail.calculation.regime', {
            regime: calc.regime === 'SIMPLIFIED_DECLARATION'
              ? t('declarations.regime.SIMPLIFIED_DECLARATION')
              : calc.regime,
          })}
        </p>
      </div>

      <div className="p-6 flex flex-col gap-5">
        {/* Income → Deductions → Taxable */}
        <div className="flex flex-col gap-2">
          <CalcRow
            label={t('declarations.detail.calculation.grossIncome')}
            value={calc.grossIncome}
            color="text-white"
            size="lg"
          />

          {/* Deductions list */}
          {calc.deductions.length > 0 && (
            <div className="ml-4 flex flex-col gap-1.5 py-2 border-l-2 border-border pl-4">
              <p className="font-body text-[12px] text-white-dim mb-1">{t('declarations.detail.calculation.deductions')}</p>
              {calc.deductions.map((ded) => (
                <div key={ded.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-body text-[13px] text-white">{ded.name}</p>
                    <p className="font-body text-[11px] text-white-dim">{ded.description}</p>
                  </div>
                  <span className="font-mono text-[13px] text-green whitespace-nowrap tabular-nums">
                    {t('common.money.kztNegative', { value: moneyFormatter.format(ded.amount) })}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-border">
                <span className="font-body text-[12px] text-white-dim">{t('declarations.detail.calculation.totalDeductions')}</span>
                <span className="font-mono text-[13px] text-green tabular-nums">
                  {t('common.money.kztNegative', { value: moneyFormatter.format(calc.totalDeductions) })}
                </span>
              </div>
            </div>
          )}

          <CalcRow label={t('declarations.detail.calculation.taxableIncome')} value={calc.taxableIncome} color="text-white" size="md" />
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Tax components */}
        <div className="flex flex-col gap-2">
          <CalcRow
            label={t('declarations.detail.calculation.incomeTax', { rate: (calc.taxRate * 100).toFixed(0) })}
            value={calc.incomeTax}
            color="text-amber"
          />
          {calc.socialTax > 0 && (
            <CalcRow label={t('declarations.detail.calculation.socialTax')} value={calc.socialTax} color="text-amber" />
          )}
          <CalcRow label={t('declarations.detail.calculation.pension')} value={calc.pensionContribution} color="text-amber" />
          <CalcRow label={t('declarations.detail.calculation.medical')} value={calc.medicalInsurance} color="text-amber" />
        </div>

        {/* Total */}
        <div
          className="rounded-xl px-4 py-4 flex items-center justify-between"
          style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.15)' }}
        >
          <div>
            <p className="font-body font-semibold text-[16px] text-white">{t('declarations.detail.calculation.totalDue')}</p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">
              {t('declarations.detail.calculation.effectiveRate', { rate: (calc.effectiveRate * 100).toFixed(1) })}
            </p>
          </div>
          <span className="font-mono font-semibold text-[22px] text-amber tabular-nums">
            {t('common.money.kzt', { value: moneyFormatter.format(calc.totalTaxBurden) })}
          </span>
        </div>

        {/* AI savings */}
        {calc.aiOptimizedSavings > 0 && (
          <div
            className="rounded-xl px-4 py-4 flex items-center gap-3"
            style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.2)' }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,232,122,0.12)' }}
            >
              <svg className="w-4 h-4 text-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-body font-semibold text-[14px] text-green">{t('declarations.detail.calculation.aiOptimization')}</p>
              <p className="font-body text-[12px] text-white-dim mt-0.5">
                {t('declarations.detail.calculation.aiSavingsFound')}
              </p>
            </div>
            <span className="font-mono font-semibold text-[18px] text-green tabular-nums">
              {t('common.money.kztPositive', { value: moneyFormatter.format(calc.aiOptimizedSavings) })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function CalcRow({
  label, value, color, size = 'sm',
}: {
  label: string
  value: number
  color: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const { t } = useTranslation()
  const moneyFormatter = new Intl.NumberFormat(getIntlLocale())

  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn(
        'font-body text-white-dim',
        size === 'lg' ? 'text-[15px]' : size === 'md' ? 'text-[14px]' : 'text-[13px]',
      )}>
        {label}
      </span>
      <span className={cn(
        'font-mono tabular-nums',
        color,
        size === 'lg' ? 'font-semibold text-[18px]' : size === 'md' ? 'font-medium text-[15px]' : 'text-[13px]',
      )}>
        {t('common.money.kzt', { value: moneyFormatter.format(value) })}
      </span>
    </div>
  )
}

// ── Success overlay ────────────────────────────────────────────────────────────
function SuccessOverlay({
  visible,
  code,
  onClose,
}: {
  visible: boolean
  code: string
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(6,12,26,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="bg-navy-3 border border-green/30 rounded-2xl p-8 max-w-[420px] w-full text-center"
            style={{ boxShadow: '0 0 60px rgba(0,232,122,0.15)' }}
          >
            <div className="w-16 h-16 rounded-full bg-[rgba(0,232,122,0.12)] border border-green/30 flex items-center justify-center text-3xl mx-auto">
              🎉
            </div>

            <h2 className="font-display text-[24px] text-white mt-5">
              {t('declarations.detail.success.title')}
            </h2>
            <p className="font-body text-[15px] text-white-dim mt-2">
              {t('declarations.detail.success.text')}
            </p>

            <div
              className="mt-5 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.2)' }}
            >
              <p className="font-body text-[12px] text-white-dim">{t('declarations.detail.success.codeLabel')}</p>
              <p className="font-mono font-semibold text-[18px] text-green mt-1 tracking-widest">{code}</p>
            </div>

            <Button variant="primary" size="md" className="mt-6 w-full" onClick={onClose}>
              {t('common.actions.done')}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Right panel ────────────────────────────────────────────────────────────────
function RightPanel({
  decl,
  onSubmitSuccess,
}: {
  decl: Declaration
  onSubmitSuccess: (updated: Declaration) => void
}) {
  const { t } = useTranslation()
  const { submitDeclaration } = useDeclarationStore()
  const [showSigning,  setShowSigning]  = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [showSuccess,  setShowSuccess]  = useState(false)
  const [successCode,  setSuccessCode]  = useState('')

  // Called by EGovSigningModal after NCALayer signs the XML
  async function handleSigned(signedXml: string) {
    setSubmitting(true)
    try {
      const updated = await submitDeclaration(decl.id, signedXml)
      setSuccessCode(updated.eGovConfirmationCode ?? '')
      setShowSuccess(true)
      onSubmitSuccess(updated)
    } catch {
      toast.error(t('declarations.toast.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleSuccessClose() {
    setShowSuccess(false)
    toast.success(t('declarations.toast.submitted'))
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      const blob = await downloadDeclarationPdfApi(decl.id)
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `form-910-${decl.period}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
      toast.success(t('declarations.toast.pdfDownloading'))
    } catch {
      toast.error(t('declarations.toast.pdfDownloadError'))
    } finally {
      setDownloadingPdf(false)
    }
  }

  const canSubmit  = (decl.status === 'READY' || decl.status === 'DRAFT') && decl.calculation != null
  const isAccepted = decl.status === 'ACCEPTED'
  const canDownloadPdf = decl.formType === 'FORM_910' && decl.calculation != null

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Status tracker card */}
        <div className="bg-navy-3 border border-border rounded-2xl p-6">
          <h3 className="font-body font-semibold text-[16px] text-white mb-5">{t('declarations.detail.statusTitle')}</h3>
          <StatusTracker status={decl.status} />

          {decl.eGovConfirmationCode != null && (
            <div
              className="mt-5 px-3 py-3 rounded-xl"
              style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.2)' }}
            >
              <p className="font-body text-[11px] text-white-dim">
                {isAccepted ? t('declarations.detail.confirmationCode') : t('declarations.detail.egovRegistrationNumber')}
              </p>
              <p className="font-mono text-[13px] text-green mt-0.5 tracking-wider break-all">
                {decl.eGovConfirmationCode}
              </p>
              {decl.eGovConfirmationCode.startsWith('LOCAL-SIGNED-') && (
                <p className="font-body text-[11px] text-white-dim mt-1.5">
                  {t('declarations.detail.localSignedPrefix')}{' '}
                  <a
                    href="https://knp.kgd.gov.kz/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green hover:opacity-80"
                  >
                    knp.kgd.gov.kz
                  </a>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions card */}
        <div className="bg-navy-3 border border-border rounded-2xl p-6 flex flex-col gap-3">
          <h3 className="font-body font-semibold text-[16px] text-white mb-1">{t('declarations.detail.actionsTitle')}</h3>

          {/* Download PDF */}
          <Button
            variant="secondary"
            size="md"
            className="w-full justify-center"
            disabled={!canDownloadPdf || downloadingPdf}
            loading={downloadingPdf}
            onClick={() => void handleDownloadPdf()}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {canDownloadPdf
              ? t('declarations.detail.downloadPdf')
              : decl.formType === 'FORM_910'
                ? t('declarations.detail.pdfRequiresCalculation')
                : t('declarations.detail.pdfUnsupported')}
          </Button>

          {/* Submit to eGov — opens NCALayer signing modal */}
          {!isAccepted && decl.status !== 'SUBMITTED' && (
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              disabled={!canSubmit || submitting}
              loading={submitting}
              onClick={() => setShowSigning(true)}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {t('declarations.detail.signAndSubmit')}
            </Button>
          )}

          {decl.status === 'SUBMITTED' && (
            <div
              className="flex items-center gap-2 justify-center py-2 rounded-lg"
              style={{ background: 'rgba(0,178,255,0.06)' }}
            >
              <span className="text-[#00B2FF] text-[14px]">📤</span>
              <span className="font-body text-[13px] text-[#00B2FF] font-medium">{t('declarations.detail.awaitingConfirmation')}</span>
            </div>
          )}

          {isAccepted && (
            <div
              className="flex items-center gap-2 justify-center py-2 rounded-lg"
              style={{ background: 'rgba(0,232,122,0.06)' }}
            >
              <span className="text-green text-[14px]">✓</span>
              <span className="font-body text-[13px] text-green font-medium">{t('declarations.detail.acceptedByTaxAuthority')}</span>
            </div>
          )}
        </div>
      </div>

      {/* NCALayer signing modal */}
      <EGovSigningModal
        open={showSigning}
        decl={decl}
        onClose={() => setShowSigning(false)}
        onSigned={(signedXml) => {
          setShowSigning(false)
          void handleSigned(signedXml)
        }}
      />

      <SuccessOverlay
        visible={showSuccess}
        code={successCode}
        onClose={handleSuccessClose}
      />
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function DeclarationDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { getById, calculateDeclaration, initialized, fetchDeclarations } = useDeclarationStore()

  const [decl, setDecl]       = useState<Declaration | undefined>(getById(id ?? ''))
  const [loadError, setLoadError] = useState(false)

  // Load from API if not already in store
  useEffect(() => {
    if (decl != null) return
    if (!initialized) {
      void fetchDeclarations().then(() => {
        const found = getById(id ?? '')
        if (found) {
          setDecl(found)
        } else {
          // Not in list — fetch directly
          void getDeclarationApi(id ?? '').then(setDecl).catch(() => setLoadError(true))
        }
      })
      return
    }
    // Store is initialized but declaration not found — try fetching directly
    void getDeclarationApi(id ?? '').then(setDecl).catch(() => setLoadError(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Sync with store updates (after calculate/submit)
  useEffect(() => {
    const latest = getById(id ?? '')
    if (latest != null) setDecl(latest)
  }, [getById, id])

  if (loadError) {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center gap-4">
        <p className="font-display text-[24px] text-white">{t('declarations.detail.notFound')}</p>
        <Link to="/declarations" className="font-body text-[14px] text-green hover:text-green-dim">
          {t('declarations.detail.backToList')}
        </Link>
      </div>
    )
  }

  if (decl == null) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  async function handleCalculate() {
    if (!decl) return
    try {
      const updated = await calculateDeclaration(decl.id)
      setDecl(updated)
      toast.success(t('declarations.toast.calculated'))
    } catch {
      toast.error(t('declarations.toast.calculateError'))
    }
  }

  return (
    <div className="min-h-screen bg-navy px-10 py-10 max-lg:px-4 max-lg:py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 font-body text-[13px]">
        <Link to="/declarations" className="text-white-dim hover:text-white transition-colors">
          {t('declarations.title')}
        </Link>
        <span className="text-white-dim">/</span>
        <span className="text-white">{decl.period}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-display text-[28px] text-white">
            {t(`declarations.form.${decl.formType}.label`, { defaultValue: decl.formType })}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="font-mono text-[15px] text-white-dim">{decl.period}</span>
            <StatusChip status={decl.status} />
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-[1fr_360px] max-lg:grid-cols-1 gap-6">
        {/* Left: calculation */}
        <CalculationPanel decl={decl} onCalculate={handleCalculate} />

        {/* Right: status + actions */}
        <RightPanel decl={decl} onSubmitSuccess={setDecl} />
      </div>
    </div>
  )
}

// ── Status chip (header) ───────────────────────────────────────────────────────
const STATUS_CHIP_STYLE: Record<DeclarationStatus, { bg: string; color: string }> = {
  DRAFT:     { bg: 'rgba(240,244,255,0.08)', color: 'rgba(240,244,255,0.6)' },
  READY:     { bg: 'rgba(255,184,0,0.1)',    color: '#FFB800' },
  SUBMITTED: { bg: 'rgba(0,178,255,0.1)',    color: '#00B2FF' },
  ACCEPTED:  { bg: 'rgba(0,232,122,0.1)',    color: '#00E87A' },
  REJECTED:  { bg: 'rgba(255,77,77,0.1)',    color: '#FF4D4D' },
}

function StatusChip({ status }: { status: DeclarationStatus }) {
  const { t } = useTranslation()
  const s = STATUS_CHIP_STYLE[status]
  return (
    <span
      className="inline-flex items-center font-mono font-medium text-[12px] px-3 py-1 rounded-full uppercase tracking-wide"
      style={{ background: s.bg, color: s.color }}
    >
      {t(`declarations.status.${status}`)}
    </span>
  )
}
