/// <reference types="vite/client" />
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import type { Declaration } from 'nalogai-shared/types/declaration.types'
import type { NCAKeyInfo } from '@services/ncalayer'
import {
  checkNCALayerAvailable,
  connectAndSign,
  buildDeclarationXML,
  validateSignedXML,
  NCALAYER_DOWNLOAD_URL,
  KGD_CABINET_URL,
  NCANotRunningError,
  NCATimeoutError,
  NCAWrongPasswordError,
  NCAKeyExpiredError,
  NCAUserCancelledError,
  NCAWrongKeyTypeError,
  NCAInvalidSignatureError,
  NCADisconnectedError,
  NCABinMismatchError,
  NCARevokedCertError,
} from '@services/ncalayer'
import { useAuthStore } from '@store/authStore'
import { cn } from '@utils/cn'
import { getIntlLocale } from '@/i18n'

// ── Step & error types ─────────────────────────────────────────────────────────

type Step = 'idle' | 'checking' | 'signing' | 'done' | 'error'

type ErrorKind =
  | 'ncalayer_missing'
  | 'wrong_password'
  | 'key_expired'
  | 'key_revoked'
  | 'bin_mismatch'
  | 'wrong_key_type'
  | 'user_cancelled'
  | 'invalid_signature'
  | 'timeout'
  | 'disconnected'
  | 'generic'

interface StepState {
  step: Step
  keyInfo: NCAKeyInfo | null
  signedXml: string | null
  unsignedXml: string | null
  errorKind: ErrorKind | null
  errorMessage: string | null
}

const INITIAL_STATE: StepState = {
  step: 'idle',
  keyInfo: null,
  signedXml: null,
  unsignedXml: null,
  errorKind: null,
  errorMessage: null,
}

function classifyError(err: unknown): ErrorKind {
  if (err instanceof NCANotRunningError) return 'ncalayer_missing'
  if (err instanceof NCATimeoutError)    return 'timeout'
  if (err instanceof NCAWrongPasswordError) return 'wrong_password'
  if (err instanceof NCAKeyExpiredError)    return 'key_expired'
  if (err instanceof NCARevokedCertError)   return 'key_revoked'
  if (err instanceof NCABinMismatchError)   return 'bin_mismatch'
  if (err instanceof NCAUserCancelledError) return 'user_cancelled'
  if (err instanceof NCAWrongKeyTypeError)  return 'wrong_key_type'
  if (err instanceof NCAInvalidSignatureError) return 'invalid_signature'
  if (err instanceof NCADisconnectedError)  return 'disconnected'
  return 'generic'
}

// ── Framer Motion spinner ──────────────────────────────────────────────────────

function MotionSpinner({ size = 32 }: { size?: number }) {
  return (
    <motion.div
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      className="rounded-full border-[3px] border-green border-t-transparent"
    />
  )
}

// ── Shared status row ──────────────────────────────────────────────────────────

function StatusRow({
  icon, label, value, mono = false,
}: {
  icon: string; label: string; value: string; mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-[14px]">{icon}</span>
        <span className="font-body text-[13px] text-white-dim">{label}</span>
      </div>
      <span className={cn(
        'text-[13px] text-white text-right max-w-[55%] truncate',
        mono ? 'font-mono' : 'font-body font-medium',
      )}>
        {value}
      </span>
    </div>
  )
}

// ── NCALayer not-found panel ───────────────────────────────────────────────────

function NCALayerNotFoundPanel({
  onRetry,
  onDownloadXml,
  unsignedXml,
  period,
}: {
  onRetry: () => void
  onDownloadXml: (() => void) | null
  unsignedXml: string | null
  period: string
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div
        className="rounded-xl p-5 flex flex-col gap-4"
        style={{ background: 'rgba(19,31,53,1)', border: '1px solid rgba(0,232,122,0.2)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,232,122,0.1)', border: '1px solid rgba(0,232,122,0.25)' }}
          >
            <span className="text-[18px]">🔌</span>
          </div>
          <div>
            <p className="font-body font-bold text-[15px] text-white">{t('declarations.signing.ncalayerMissing.title')}</p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">
              {t('declarations.signing.ncalayerMissing.text')}
            </p>
          </div>
        </div>

        {/* Steps */}
        <ol className="flex flex-col gap-2.5 pl-1">
          {[
            'declarations.signing.ncalayerMissing.step1',
            'declarations.signing.ncalayerMissing.step2',
            'declarations.signing.ncalayerMissing.step3',
          ].map((stepKey, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-mono text-[11px] font-bold text-green"
                style={{ background: 'rgba(0,232,122,0.12)', border: '1px solid rgba(0,232,122,0.3)' }}
              >
                {i + 1}
              </span>
              <span className="font-body text-[13px] text-white-dim leading-relaxed">{t(stepKey)}</span>
            </li>
          ))}
        </ol>

        {/* Download link */}
        <a
          href={NCALAYER_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-body font-semibold text-[13px] text-green hover:opacity-80 transition-opacity"
        >
          <span className="text-[14px]">⬇</span>
          {t('declarations.signing.downloadNcalayer')}
        </a>
      </div>

      {/* Actions */}
      <Button
        variant="primary"
        size="md"
        className="w-full"
        onClick={onRetry}
      >
        {t('declarations.signing.retryConnection')}
      </Button>

      {/* Fallback section */}
      {unsignedXml != null && onDownloadXml != null && (
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'rgba(13,21,38,1)', border: '1px solid rgba(240,244,255,0.08)' }}
        >
          <p className="font-body text-[12px] text-white-dim leading-relaxed">
            {t('declarations.signing.manualFallback')}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onDownloadXml}
              className="inline-flex items-center gap-1.5 font-body font-medium text-[13px] text-white hover:text-green transition-colors"
            >
              <span className="text-[14px]">📄</span>
              {t('declarations.signing.downloadDeclarationXml', { period })}
            </button>
            <a
              href={KGD_CABINET_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={t('declarations.signing.kgdCabinetHint')}
              className="inline-flex items-center gap-1.5 font-body font-medium text-[13px] text-white-dim hover:text-white transition-colors"
            >
              <span className="text-[14px]">🌐</span>
              {t('declarations.signing.openKgdCabinet')}
            </a>
            <p className="font-body text-[11px] text-white-dim opacity-60 leading-relaxed mt-0.5">
              {t('declarations.signing.kgdCabinetSteps')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Error panel ────────────────────────────────────────────────────────────────

function ErrorPanel({
  kind,
  message,
  onRetry,
  onDownloadXml,
  unsignedXml,
  period,
}: {
  kind: ErrorKind
  message: string | null
  onRetry: () => void
  onDownloadXml: (() => void) | null
  unsignedXml: string | null
  period: string
}) {
  const { t } = useTranslation()
  const configs: Record<Exclude<ErrorKind, 'ncalayer_missing'>, { icon: string; title: string; body: string }> = {
    wrong_password: {
      icon: '🔐',
      title: t('declarations.signing.errors.wrongPassword.title'),
      body: t('declarations.signing.errors.wrongPassword.body'),
    },
    key_expired: {
      icon: '⏰',
      title: t('declarations.signing.errors.keyExpired.title'),
      body: t('declarations.signing.errors.keyExpired.body'),
    },
    key_revoked: {
      icon: '🚫',
      title: t('declarations.signing.errors.keyRevoked.title'),
      body: t('declarations.signing.errors.keyRevoked.body'),
    },
    bin_mismatch: {
      icon: '🪪',
      title: t('declarations.signing.errors.binMismatch.title'),
      body: message ?? t('declarations.signing.errors.binMismatch.body'),
    },
    wrong_key_type: {
      icon: '🔑',
      title: t('declarations.signing.errors.wrongKeyType.title'),
      body: message ?? t('declarations.signing.errors.wrongKeyType.body'),
    },
    user_cancelled: {
      icon: '✋',
      title: t('declarations.signing.errors.userCancelled.title'),
      body: t('declarations.signing.errors.userCancelled.body'),
    },
    invalid_signature: {
      icon: '⚠️',
      title: t('declarations.signing.errors.invalidSignature.title'),
      body: t('declarations.signing.errors.invalidSignature.body'),
    },
    timeout: {
      icon: '⌛',
      title: t('declarations.signing.errors.timeout.title'),
      body: t('declarations.signing.errors.timeout.body'),
    },
    disconnected: {
      icon: '🔌',
      title: t('declarations.signing.errors.disconnected.title'),
      body: t('declarations.signing.errors.disconnected.body'),
    },
    generic: {
      icon: '❌',
      title: t('declarations.signing.errors.generic.title'),
      body: message ?? t('declarations.signing.errors.generic.body'),
    },
  }

  const cfg = configs[kind as Exclude<ErrorKind, 'ncalayer_missing'>]

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.2)' }}
      >
        <span className="text-[22px] mt-0.5 flex-shrink-0">{cfg.icon}</span>
        <div>
          <p className="font-body font-bold text-[14px] text-red">{cfg.title}</p>
          <p className="font-body text-[13px] text-white-dim mt-1 leading-relaxed">{cfg.body}</p>
        </div>
      </div>

      <Button variant="primary" size="md" className="w-full" onClick={onRetry}>
        {t('declarations.signing.retry')}
      </Button>

      {/* Fallback manual upload */}
      {unsignedXml != null && onDownloadXml != null && (
        <div
          className="rounded-xl p-4 flex flex-col gap-2"
          style={{ background: 'rgba(13,21,38,1)', border: '1px solid rgba(240,244,255,0.08)' }}
        >
          <p className="font-body text-[12px] text-white-dim">
            {t('declarations.signing.manualAlternative')}
          </p>
          <button
            type="button"
            onClick={onDownloadXml}
            className="inline-flex items-center gap-1.5 font-body font-medium text-[13px] text-white hover:text-green transition-colors"
          >
            <span>📄</span>
            {t('declarations.signing.downloadDeclarationXml', { period })}
          </button>
          <a
            href={KGD_CABINET_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={t('declarations.signing.kgdCabinetHint')}
            className="inline-flex items-center gap-1.5 font-body font-medium text-[13px] text-white-dim hover:text-white transition-colors"
          >
            <span>🌐</span>
            {t('declarations.signing.kgdCabinetShort')}
          </a>
        </div>
      )}
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  decl: Declaration
  onClose: () => void
  onSigned: (signedXml: string) => void
}

export function EGovSigningModal({ open, decl, onClose, onSigned }: Props) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [state, setState] = useState<StepState>(INITIAL_STATE)

  const calc = decl.calculation
  const iin  = user?.iin

  function reset() {
    setState(INITIAL_STATE)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function buildXML(): string | null {
    if (!calc || !iin || !user) return null
    return buildDeclarationXML({
      iin,
      fullName:        user.fullName,
      period:          decl.period,
      formType:        decl.formType,
      grossIncome:     calc.grossIncome,
      incomeTax:       calc.incomeTax,
      socialTax:       calc.socialTax,
      pensionContrib:  calc.pensionContribution,
      medicalInsurance: calc.medicalInsurance,
      taxableIncome:   calc.taxableIncome,
      totalDeductions: calc.totalDeductions,
    })
  }

  function downloadXml(xml: string | null, filename?: string) {
    if (!xml) return
    const blob = new Blob([xml], { type: 'application/xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename ?? `declaration-${decl.period}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function startSigning() {
    // Prevent concurrent connections — user may double-click or retry while in progress
    if (state.step === 'checking' || state.step === 'signing') return
    if (!calc || !iin) return

    const unsignedXml = buildXML()
    if (!unsignedXml) return

    // Step 1: Pre-check NCALayer availability
    setState({ ...INITIAL_STATE, step: 'checking', unsignedXml })

    const available = await checkNCALayerAvailable()
    if (!available) {
      setState({
        ...INITIAL_STATE,
        step: 'error',
        errorKind: 'ncalayer_missing',
        errorMessage: null,
        unsignedXml,
      })
      return
    }

    // Step 2: Sign (pass user IIN for BIN mismatch validation per KGD 2026 §4.3.2)
    setState((prev) => ({ ...prev, step: 'signing' }))
    try {
      const { keyInfo, signedXml } = await connectAndSign(unsignedXml, 'GOST3410_2015_256', iin)

      // Extra: validate signed XML before accepting it
      validateSignedXML(signedXml)

      setState({
        step: 'done',
        keyInfo,
        signedXml,
        unsignedXml,
        errorKind: null,
        errorMessage: null,
      })
    } catch (err) {
      const kind    = classifyError(err)
      const message = err instanceof Error ? err.message : null
      setState({
        ...INITIAL_STATE,
        step: 'error',
        errorKind: kind,
        errorMessage: message,
        unsignedXml,
      })
    }
  }

  function handleRetry() {
    void startSigning()
  }

  function handleConfirmSigned() {
    if (state.signedXml) {
      onSigned(state.signedXml)
      handleClose()
    }
  }

  const canDownloadXml = state.unsignedXml != null
  const downloadFallback = canDownloadXml
    ? () => downloadXml(state.unsignedXml, `declaration-${decl.period}-unsigned.xml`)
    : null

  return (
    <Modal open={open} onClose={handleClose} title={t('declarations.signing.title')}>
      <div className="flex flex-col gap-5 mt-2">

        {/* IIN warning */}
        {!iin && (
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(255,77,77,0.07)', border: '1px solid rgba(255,77,77,0.2)' }}
          >
            <p className="font-body font-semibold text-[14px] text-red">{t('declarations.signing.iinMissingTitle')}</p>
            <p className="font-body text-[13px] text-white-dim mt-1">
              {t('declarations.signing.iinMissingText')}
            </p>
          </div>
        )}

        {/* Declaration summary — always visible */}
        {state.step !== 'error' || state.errorKind !== 'ncalayer_missing' ? (
          <div className="bg-navy-4 rounded-xl p-4">
            <p className="font-body font-semibold text-[11px] text-white-dim mb-3 uppercase tracking-wider">
              {t('declarations.signing.summaryTitle')}
            </p>
            <StatusRow icon="📋" label={t('declarations.table.period')} value={decl.period} mono />
            <StatusRow icon="📝" label={t('declarations.table.form')} value={t(`declarations.form.${decl.formType}.label`, { defaultValue: decl.formType })} />
            {calc != null && (
              <>
                <StatusRow
                  icon="💰"
                  label={t('declarations.detail.calculation.grossIncome')}
                  value={t('common.money.kzt', { value: new Intl.NumberFormat(getIntlLocale()).format(calc.grossIncome) })}
                  mono
                />
                <StatusRow
                  icon="🏦"
                  label={t('declarations.detail.calculation.totalDue')}
                  value={t('common.money.kzt', { value: new Intl.NumberFormat(getIntlLocale()).format(calc.totalTaxBurden) })}
                  mono
                />
              </>
            )}
            {iin != null && <StatusRow icon="🪪" label={t('settings.profile.iinTitle')} value={iin} mono />}
          </div>
        ) : null}

        {/* ── Step: idle ────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {state.step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col gap-3"
            >
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(0,178,255,0.06)', border: '1px solid rgba(0,178,255,0.15)' }}
              >
                <p className="font-body text-[13px] text-white leading-relaxed">
                  {t('declarations.signing.introPrefix')}{' '}
                  <span className="text-[#00B2FF] font-semibold">{t('declarations.signing.introHighlight')}</span>{' '}
                  {t('declarations.signing.introSuffix')}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" size="md" className="flex-1" onClick={handleClose}>
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  disabled={!iin || !calc}
                  onClick={() => void startSigning()}
                >
                  {t('declarations.signing.signEds')}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step: checking ─────────────────────────────────────────────── */}
          {state.step === 'checking' && (
            <motion.div
              key="checking"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <MotionSpinner size={40} />
              <div className="text-center">
                <p className="font-body font-semibold text-[15px] text-white">
                  {t('declarations.signing.checkingTitle')}
                </p>
                <p className="font-body text-[13px] text-white-dim mt-1">
                  {t('declarations.signing.checkingText')}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step: signing ──────────────────────────────────────────────── */}
          {state.step === 'signing' && (
            <motion.div
              key="signing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <MotionSpinner size={40} />
              <div className="text-center">
                <p className="font-body font-semibold text-[15px] text-white">
                  {t('declarations.signing.signingTitle')}
                </p>
                <p className="font-body text-[13px] text-white-dim mt-1">
                  {t('declarations.signing.signingText')}
                </p>
              </div>
              <div
                className="rounded-lg px-4 py-2.5 mt-2"
                style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.15)' }}
              >
                <p className="font-mono text-[11px] text-green text-center">
                  {t('declarations.signing.cryptoStack')}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step: done ────────────────────────────────────────────────── */}
          {state.step === 'done' && state.keyInfo != null && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              {/* SIGN key warning (should not happen after our pre-check, defensive) */}
              {state.keyInfo.keyUsage !== 'SIGN' && (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)' }}
                >
                  <p className="font-body font-semibold text-[13px] text-amber">
                    {t('declarations.signing.authKeyDetectedTitle')}
                  </p>
                  <p className="font-body text-[12px] text-white-dim mt-0.5 leading-relaxed">
                    {t('declarations.signing.authKeyDetectedTextPrefix')}{' '}
                    <strong className="text-white">{t('declarations.signing.signKeyName')}</strong>.
                    {' '}{t('declarations.signing.authKeyDetectedTextSuffix')}
                  </p>
                </div>
              )}

              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.2)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[18px]">✅</span>
                  <p className="font-body font-semibold text-[14px] text-green">
                    {t('declarations.signing.signedTitle')}
                  </p>
                </div>
                <StatusRow icon="🪪" label={t('declarations.signing.subject')} value={state.keyInfo.subjectDn} />
                <StatusRow icon="📅" label={t('declarations.signing.validTo')} value={new Intl.DateTimeFormat(getIntlLocale()).format(new Date(state.keyInfo.validTo))} />
                <StatusRow icon="🔑" label={t('declarations.signing.keyType')} value={state.keyInfo.keyUsage === 'SIGN' ? t('declarations.signing.signKeyValid') : t('declarations.signing.authKeyWarning')} />
                <StatusRow icon="🔒" label={t('declarations.signing.algorithm')} value="GOST3410_2015_256" mono />
              </div>

              {/* Download signed XML */}
              <button
                type="button"
                className="font-body text-[12px] text-white-dim hover:text-white transition-colors text-center underline underline-offset-2"
                onClick={() => downloadXml(state.signedXml, `declaration-${decl.period}-signed.xml`)}
              >
                {t('declarations.signing.downloadSignedXml')}
              </button>

              <p className="font-body text-[13px] text-white-dim text-center">
                {t('declarations.signing.sendHint')}
              </p>

              <div className="flex gap-3">
                <Button variant="ghost" size="md" className="flex-1" onClick={handleClose}>
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  disabled={state.keyInfo.keyUsage !== 'SIGN'}
                  onClick={handleConfirmSigned}
                >
                  {t('declarations.signing.sendToEgov')}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step: error ────────────────────────────────────────────────── */}
          {state.step === 'error' && state.errorKind != null && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              {state.errorKind === 'ncalayer_missing' ? (
                <NCALayerNotFoundPanel
                  onRetry={handleRetry}
                  onDownloadXml={downloadFallback}
                  unsignedXml={state.unsignedXml}
                  period={decl.period}
                />
              ) : (
                <ErrorPanel
                  kind={state.errorKind}
                  message={state.errorMessage}
                  onRetry={handleRetry}
                  onDownloadXml={downloadFallback}
                  unsignedXml={state.unsignedXml}
                  period={decl.period}
                />
              )}

              {/* Close link always available */}
              <button
                type="button"
                onClick={handleClose}
                className="font-body text-[12px] text-white-dim hover:text-white transition-colors text-center"
              >
                {t('common.actions.close')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
