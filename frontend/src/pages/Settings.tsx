import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { BusinessType, TaxRegime, SubscriptionPlan } from 'nalogai-shared/types/user.types'
import { useAuthStore, getEffectivePlan } from '@store/authStore'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { BankConnectModal, type BankProvider } from '@components/banks/BankConnectModal'
import { PaymentModal } from '@components/payment/PaymentModal'
import { disconnectBankApi, syncBankApi } from '@api/banks.api'
import { updateProfileApi } from '@api/users.api'
import { validateIIN } from 'nalogai-shared/utils/iinValidator'
import { cn } from '@utils/cn'
import { toast } from '@store/notificationStore'
import { LanguageSelector } from '../i18n/LanguageSelector'

// ── IIN Zod schema ─────────────────────────────────────────────────────────────
const iinSchema = z.object({
  iin: z
    .string()
    .length(12, 'ИИН должен содержать ровно 12 цифр')
    .regex(/^\d{12}$/, 'ИИН содержит только цифры')
    .refine((v) => validateIIN(v), 'Неверная контрольная сумма ИИН — проверьте номер'),
})

type IINFormValues = z.infer<typeof iinSchema>

function maskIIN(iin: string): string {
  if (iin.length !== 12) return iin
  return `${iin.slice(0, 6)}••••••`
}

// ── Tab system ─────────────────────────────────────────────────────────────────
type Tab = 'profile' | 'banks' | 'notifications' | 'plan' | 'security'

const TABS: { id: Tab; labelKey: string; icon: string }[] = [
  { id: 'profile',       labelKey: 'settings.tabs.profile',        icon: '👤' },
  { id: 'banks',         labelKey: 'settings.tabs.banks',           icon: '🏦' },
  { id: 'notifications', labelKey: 'settings.tabs.notifications',   icon: '🔔' },
  { id: 'plan',          labelKey: 'settings.tabs.plan',            icon: '⭐' },
  { id: 'security',      labelKey: 'settings.tabs.security',        icon: '🔒' },
]

// ── Profile tab ────────────────────────────────────────────────────────────────
const BUSINESS_OPTIONS: { value: BusinessType; labelKey: string; descKey: string }[] = [
  { value: 'SELF_EMPLOYED',  labelKey: 'settings.profile.business.selfEmployed', descKey: 'settings.profile.business.selfEmployedDesc' },
  { value: 'SOLE_PROPRIETOR', labelKey: 'settings.profile.business.soleProprietor', descKey: 'settings.profile.business.soleProprietorDesc' },
  { value: 'LLC',             labelKey: 'settings.profile.business.llc', descKey: 'settings.profile.business.llcDesc' },
]

const REGIME_OPTIONS: { value: TaxRegime; labelKey: string; descKey: string }[] = [
  { value: 'SIMPLIFIED_DECLARATION', labelKey: 'settings.profile.regime.simplified', descKey: 'settings.profile.regime.simplifiedDesc' },
  { value: 'PATENT',                 labelKey: 'settings.profile.regime.patent', descKey: 'settings.profile.regime.patentDesc' },
  { value: 'ESP',                    labelKey: 'settings.profile.regime.esp', descKey: 'settings.profile.regime.espDesc' },
  { value: 'GENERAL_REGIME',         labelKey: 'settings.profile.regime.general', descKey: 'settings.profile.regime.generalDesc' },
]

// ── IIN management sub-component ──────────────────────────────────────────────
function IINSection() {
  const { t } = useTranslation()
  const { user, setUser, accessToken } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IINFormValues>({
    resolver: zodResolver(iinSchema),
    defaultValues: { iin: '' },
  })

  async function onSubmit(values: IINFormValues) {
    setSaving(true)
    try {
      const updated = await updateProfileApi({ iin: values.iin })
      if (accessToken != null) {
        setUser(updated, accessToken)
      }
      toast.success(t('settings.profile.iinSaved'))
      setEditing(false)
      reset({ iin: '' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('settings.profile.iinSaveError')
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const currentIIN = user?.iin ?? null

  return (
    <Section title={t('settings.profile.iinTitle')}>
      {/* Current IIN display */}
      <div className="bg-navy-4 border border-border rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-body text-[12px] text-white-dim mb-0.5">{t('settings.profile.currentIin')}</p>
          {currentIIN != null ? (
            <p className="font-mono text-[15px] text-white tracking-wider">{maskIIN(currentIIN)}</p>
          ) : (
            <Badge variant="amber" size="sm">{t('settings.profile.iinMissing')}</Badge>
          )}
        </div>
        {!editing && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {t('settings.profile.changeIin')}
          </Button>
        )}
      </div>

      {/* Inline edit form */}
      <AnimatePresence>
        {editing && (
          <motion.form
            key="iin-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="flex flex-col gap-3 overflow-hidden"
          >
            <div>
              <label className="block font-body text-sm font-medium text-white-dim mb-1.5">
                {t('settings.profile.newIin')}
              </label>
              <input
                {...register('iin', {
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12)
                  },
                })}
                type="text"
                inputMode="numeric"
                placeholder="123456789012"
                maxLength={12}
                autoComplete="off"
                className={cn(
                  'w-full h-11 bg-navy-4 border rounded-lg px-4',
                  'font-mono text-[14px] text-white tracking-widest',
                  'placeholder:text-white-dim/40 placeholder:font-mono placeholder:tracking-normal',
                  'focus:outline-none focus:ring-2 focus:ring-green/40',
                  'transition-all duration-150',
                  errors.iin != null
                    ? 'border-red focus:ring-red/30'
                    : 'border-border hover:border-white/20',
                )}
              />
              {errors.iin != null && (
                <p className="mt-1.5 font-body text-[12px] text-red">{errors.iin.message}</p>
              )}
              {errors.iin == null && (
                <p className="mt-1.5 font-body text-[12px] text-white-dim">
                  {t('settings.profile.iinHint')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" loading={saving} type="submit">
                {t('common.actions.save')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setEditing(false)
                  reset({ iin: '' })
                }}
              >
                {t('common.actions.cancel')}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </Section>
  )
}

function ProfileTab() {
  const { t } = useTranslation()
  const { user, setUser, accessToken } = useAuthStore()
  const [fullName, setFullName]         = useState(user?.fullName ?? '')
  const [businessType, setBusinessType] = useState<BusinessType>(user?.businessType ?? 'SOLE_PROPRIETOR')
  const [taxRegime, setTaxRegime]       = useState<TaxRegime>(user?.taxRegime ?? 'SIMPLIFIED_DECLARATION')
  const [saving, setSaving]             = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateProfileApi({
        fullName,
        businessType,
        taxRegime,
      })
      // Sync updated profile back into authStore so EGovSigningModal sees fresh data
      if (accessToken != null) {
        setUser(updated, accessToken)
      }
      toast.success(t('settings.profile.saved'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('settings.profile.saveError')
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-[600px] flex flex-col gap-6">
      {/* IIN management */}
      <IINSection />

      {/* Basic info */}
      <Section title={t('settings.profile.basic')}>
        <Input
          label={t('settings.profile.fullName')}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Иван Иванов"
        />
        <div>
          <label className="block font-body text-sm font-medium text-white-dim mb-1.5">Email</label>
          <div className="h-11 bg-navy-4 border border-border rounded-lg px-4 flex items-center">
            <span className="font-body text-[14px] text-white-dim">{user?.email ?? 'user@example.com'}</span>
            <span className="ml-auto font-mono text-[11px] text-white-dim bg-navy-3 px-2 py-0.5 rounded">
              {t('settings.profile.emailLocked')}
            </span>
          </div>
        </div>
      </Section>

      {/* Business type */}
      <Section title={t('settings.profile.businessType')}>
        <div className="grid grid-cols-1 gap-2">
          {BUSINESS_OPTIONS.map((opt) => (
            <RadioCard
              key={opt.value}
              selected={businessType === opt.value}
              onClick={() => setBusinessType(opt.value)}
              label={t(opt.labelKey)}
              desc={t(opt.descKey)}
            />
          ))}
        </div>
      </Section>

      {/* Tax regime */}
      <Section title={t('settings.profile.taxRegime')}>
        <div className="grid grid-cols-1 gap-2">
          {REGIME_OPTIONS.map((opt) => (
            <RadioCard
              key={opt.value}
              selected={taxRegime === opt.value}
              onClick={() => setTaxRegime(opt.value)}
              label={t(opt.labelKey)}
              desc={t(opt.descKey)}
            />
          ))}
        </div>
      </Section>

      <Button variant="primary" size="md" loading={saving} onClick={() => void handleSave()} className="w-fit">
        {t('settings.profile.saveChanges')}
      </Button>
    </div>
  )
}

// ── Banks tab ──────────────────────────────────────────────────────────────────
interface BankEntry {
  provider: BankProvider
  name: string
  logo: string
  masked: string
  connected: boolean
}

const INITIAL_BANKS: BankEntry[] = [
  { provider: 'KASPI', name: 'Kaspi Bank', logo: '🔴', masked: '', connected: false },
  { provider: 'HALYK', name: 'Halyk Bank', logo: '🟢', masked: '', connected: false },
]

function BanksTab() {
  const { t } = useTranslation()
  const [banks, setBanks] = useState<BankEntry[]>(INITIAL_BANKS)
  const [connectingProvider, setConnectingProvider] = useState<BankProvider | null>(null)
  const [disconnecting, setDisconnecting] = useState<BankProvider | null>(null)
  const [syncing, setSyncing] = useState<BankProvider | null>(null)

  function handleConnected(provider: BankProvider, masked: string) {
    setBanks((prev) =>
      prev.map((b) => b.provider === provider ? { ...b, connected: true, masked } : b),
    )
  }

  async function handleDisconnect(provider: BankProvider) {
    setDisconnecting(provider)
    try {
      await disconnectBankApi(provider)
      setBanks((prev) =>
        prev.map((b) => b.provider === provider ? { ...b, connected: false, masked: '' } : b),
      )
      toast.success(t('settings.banks.disconnected'))
    } catch {
      setBanks((prev) =>
        prev.map((b) => b.provider === provider ? { ...b, connected: false, masked: '' } : b),
      )
      toast.success(t('settings.banks.disconnected'))
    } finally {
      setDisconnecting(null)
    }
  }

  async function handleSync(provider: BankProvider) {
    setSyncing(provider)
    try {
      const result = await syncBankApi(provider)
      if (result.synced > 0) {
        toast.success(t('settings.banks.synced', { count: result.synced }))
      } else if (result.message) {
        toast.info(result.message)
      } else {
        toast.success(t('settings.banks.syncComplete'))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('settings.banks.syncError')
      toast.error(msg)
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="max-w-[600px] flex flex-col gap-4">
      <p className="font-body text-[14px] text-white-dim">
        {t('settings.banks.intro')}
      </p>

      {/* Info banner — updated to reflect API availability */}
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.12)' }}
      >
        <span className="text-[18px] mt-0.5">✅</span>
        <div>
          <p className="font-body font-semibold text-[13px] text-white mb-0.5">
            {t('settings.banks.bannerTitle')}
          </p>
          <p className="font-body text-[13px] text-white-dim leading-relaxed">
            {t('settings.banks.bannerText')}
          </p>
        </div>
      </div>

      {banks.map((bank) => (
        <div
          key={bank.provider}
          className="bg-navy-3 border border-border rounded-2xl p-5 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-navy-4 flex items-center justify-center text-2xl shrink-0">
            {bank.logo}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body font-semibold text-[15px] text-white">{bank.name}</p>
            {bank.connected ? (
              <p className="font-mono text-[12px] text-green mt-0.5">{bank.masked} · {t('settings.banks.connected')}</p>
            ) : (
              <p className="font-body text-[12px] text-white-dim mt-0.5">{t('settings.banks.notConnected')}</p>
            )}
          </div>
          {bank.connected ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={syncing === bank.provider}
                onClick={() => void handleSync(bank.provider)}
              >
                {t('common.actions.sync')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConnectingProvider(bank.provider)}
              >
                {t('common.actions.upload')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={disconnecting === bank.provider}
                onClick={() => void handleDisconnect(bank.provider)}
              >
                {t('common.actions.disconnect')}
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setConnectingProvider(bank.provider)}>
              {t('common.actions.connect')}
            </Button>
          )}
        </div>
      ))}

      {/* Modal */}
      {connectingProvider != null && (
        <BankConnectModal
          open
          provider={connectingProvider}
          onClose={() => setConnectingProvider(null)}
          onConnected={(masked) => {
            handleConnected(connectingProvider, masked)
            setConnectingProvider(null)
          }}
        />
      )}
    </div>
  )
}

// ── Notifications tab ──────────────────────────────────────────────────────────
function NotificationsTab() {
  const { t } = useTranslation()
  const [emailOn, setEmailOn]     = useState(true)
  const [telegramOn, setTelegramOn] = useState(false)
  const [telegramId, setTelegramId] = useState('')
  const [daysBefore, setDaysBefore] = useState<number[]>([3, 7, 14])
  const [saving, setSaving]         = useState(false)

  function toggleDays(d: number) {
    setDaysBefore((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    )
  }

  async function handleSave() {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    toast.success(t('settings.notifications.saved'))
  }

  return (
    <div className="max-w-[560px] flex flex-col gap-6">
      <Section title={t('settings.notifications.channels')}>
        <Toggle
          label={t('settings.notifications.email')}
          desc={t('settings.notifications.emailDesc')}
          value={emailOn}
          onChange={setEmailOn}
        />
        <Toggle
          label={t('settings.notifications.telegram')}
          desc={t('settings.notifications.telegramDesc')}
          value={telegramOn}
          onChange={setTelegramOn}
        />
        {telegramOn && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Input
              label="Telegram Chat ID"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="123456789"
              hint={t('settings.notifications.telegramHint')}
            />
          </motion.div>
        )}
      </Section>

      <Section title={t('settings.notifications.daysBefore')}>
        <div className="flex items-center gap-2 flex-wrap">
          {[1, 3, 7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDays(d)}
              className={cn(
                'w-14 h-10 rounded-lg font-mono text-[14px] font-medium transition-all duration-150 border',
                daysBefore.includes(d)
                  ? 'bg-green/10 border-green text-green'
                  : 'bg-navy-4 border-border text-white-dim hover:border-white/30 hover:text-white',
              )}
            >
              {t('settings.notifications.dayShort', { count: d })}
            </button>
          ))}
        </div>
        <p className="font-body text-[12px] text-white-dim">
          {t('settings.notifications.selected', {
            value: daysBefore.length > 0
              ? daysBefore.map((d) => t('settings.notifications.beforeDay', { count: d })).join(', ')
              : t('settings.notifications.none'),
          })}
        </p>
      </Section>

      <Button variant="primary" size="md" loading={saving} onClick={() => void handleSave()} className="w-fit">
        {t('common.actions.save')}
      </Button>
    </div>
  )
}

// ── Plan tab ───────────────────────────────────────────────────────────────────
const PLANS: {
  id: SubscriptionPlan
  nameKey: string
  priceKey: string
  featureKeys: string[]
  color: string
  bg: string
  border: string
  ctaKey: string
  current?: boolean
}[] = [
  {
    id: 'FREE',
    nameKey: 'settings.plan.free',
    priceKey: 'settings.plan.freePrice',
    featureKeys: [
      'settings.plan.features.limit50',
      'settings.plan.features.oneDeclaration',
      'settings.plan.features.basicTax',
    ],
    color: 'rgba(240,244,255,0.6)',
    bg: 'rgba(240,244,255,0.04)',
    border: 'rgba(240,244,255,0.1)',
    ctaKey: 'settings.plan.currentCta',
  },
  {
    id: 'PRO',
    nameKey: 'Pro',
    priceKey: 'settings.plan.proPrice',
    featureKeys: [
      'settings.plan.features.unlimited',
      'settings.plan.features.allForms',
      'settings.plan.features.bankSync',
      'settings.plan.features.pdfExport',
      'settings.plan.features.emailNotifications',
    ],
    color: '#FFB800',
    bg: 'rgba(255,184,0,0.04)',
    border: 'rgba(255,184,0,0.2)',
    ctaKey: 'settings.plan.upgradePro',
    current: true,
  },
  {
    id: 'PRO_AI',
    nameKey: 'Pro AI',
    priceKey: 'settings.plan.proAiPrice',
    featureKeys: [
      'settings.plan.features.proIncluded',
      'settings.plan.features.aiUnlimited',
      'settings.plan.features.aiCategorization',
      'settings.plan.features.deductionOptimization',
      'settings.plan.features.telegramBot',
      'settings.plan.features.prioritySupport',
    ],
    color: '#00E87A',
    bg: 'rgba(0,232,122,0.04)',
    border: 'rgba(0,232,122,0.2)',
    ctaKey: 'settings.plan.upgradeProAi',
  },
]

function PlanTab() {
  const { t } = useTranslation()
  const authState = useAuthStore()
  const { setPlan } = authState
  const currentPlan = getEffectivePlan(authState)
  const [payingPlan, setPayingPlan] = useState<Exclude<SubscriptionPlan, 'FREE'> | null>(null)

  function handleSuccess(plan: SubscriptionPlan) {
    setPlan(plan)
    toast.success(t('settings.plan.activated', { plan }))
  }

  return (
    <div className="flex flex-col gap-4 max-w-[680px]">
      <p className="font-body text-[14px] text-white-dim">
        {t('settings.plan.currentPlan')}<span className="text-white font-medium">{currentPlan}</span>
      </p>

      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const isDowngrade = plan.id === 'FREE' && currentPlan !== 'FREE'
          return (
            <div
              key={plan.id}
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: plan.bg, border: `1px solid ${plan.border}` }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-body font-bold text-[16px]" style={{ color: plan.color }}>
                    {plan.id === 'FREE' ? t(plan.nameKey) : plan.nameKey}
                  </p>
                  {isCurrent && (
                    <span
                      className="font-mono text-[10px] px-2 py-0.5 rounded uppercase tracking-wide"
                      style={{ background: `${plan.color}15`, color: plan.color }}
                    >
                      {t('common.status.active')}
                    </span>
                  )}
                </div>
                <p className="font-mono font-semibold text-[18px] text-white mt-1">{t(plan.priceKey)}</p>
              </div>

              <ul className="flex flex-col gap-1.5 flex-1">
                {plan.featureKeys.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-[12px] mt-0.5" style={{ color: plan.color }}>✓</span>
                    <span className="font-body text-[13px] text-white-dim">{t(f)}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={isCurrent ? 'ghost' : isDowngrade ? 'ghost' : 'secondary'}
                size="sm"
                disabled={isCurrent || isDowngrade}
                className="w-full justify-center"
                onClick={() => {
                  if (plan.id !== 'FREE') setPayingPlan(plan.id as Exclude<SubscriptionPlan, 'FREE'>)
                }}
              >
                {isCurrent ? `✓ ${t('common.status.active')}` : isDowngrade ? t('settings.plan.basicPlan') : t(plan.ctaKey)}
              </Button>
            </div>
          )
        })}
      </div>

      {payingPlan != null && (
        <PaymentModal
          open
          plan={payingPlan}
          onClose={() => setPayingPlan(null)}
          onSuccess={(p) => { handleSuccess(p); setPayingPlan(null) }}
        />
      )}
    </div>
  )
}

// ── Security tab ───────────────────────────────────────────────────────────────
function SecurityTab() {
  const { t } = useTranslation()
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  async function handleChange() {
    setError('')
    if (newPw !== confirmPw) {
      setError(t('settings.security.passwordMismatch'))
      return
    }
    if (newPw.length < 8) {
      setError(t('settings.security.minPassword'))
      return
    }
    setSaving(true)
    await new Promise((r) => setTimeout(r, 800))
    setSaving(false)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    toast.success(t('settings.security.passwordChanged'))
  }

  return (
    <div className="max-w-[480px] flex flex-col gap-6">
      <Section title={t('settings.security.changePassword')}>
        <Input
          type="password"
          label={t('settings.security.currentPassword')}
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          placeholder="••••••••"
        />
        <Input
          type="password"
          label={t('settings.security.newPassword')}
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder="••••••••"
          hint={t('settings.security.minPassword')}
        />
        <Input
          type="password"
          label={t('settings.security.repeatPassword')}
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          placeholder="••••••••"
          error={error}
        />
        <Button variant="primary" size="md" loading={saving} onClick={() => void handleChange()} className="w-fit">
          {t('settings.security.changePassword')}
        </Button>
      </Section>

      <Section title={t('settings.security.sessions')}>
        <div className="bg-navy-4 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-body font-medium text-[14px] text-white">{t('settings.security.currentBrowser')}</p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">{t('settings.security.locationNow')}</p>
          </div>
          <span className="font-mono text-[11px] text-green bg-green/10 px-2 py-0.5 rounded uppercase">{t('common.status.active')}</span>
        </div>
        <Button
          variant="danger"
          size="sm"
          className="w-fit"
          onClick={() => toast.success(t('settings.security.ended'))}
        >
          {t('settings.security.endOther')}
        </Button>
      </Section>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function Settings() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'profile'
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'profile',
  )

  const content: Record<Tab, React.ReactNode> = {
    profile:       <ProfileTab />,
    banks:         <BanksTab />,
    notifications: <NotificationsTab />,
    plan:          <PlanTab />,
    security:      <SecurityTab />,
  }

  return (
    <div className="min-h-screen bg-navy px-10 py-10 max-lg:px-4 max-lg:py-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-display text-[28px] text-white">{t('settings.title')}</h1>
        <div className="w-[178px] max-lg:w-[156px]">
          <LanguageSelector />
        </div>
      </div>

      <div className="flex gap-8 max-lg:flex-col">
        {/* Sidebar nav */}
        <nav className="flex flex-col gap-1 w-[200px] max-lg:flex-row max-lg:w-full max-lg:flex-wrap shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl font-body text-[14px] text-left transition-all duration-150 min-w-0',
                activeTab === tab.id
                  ? 'bg-navy-3 text-white font-medium'
                  : 'text-white-dim hover:text-white hover:bg-white-ghost',
              )}
            >
              <span>{tab.icon}</span>
              <span className="min-w-0 whitespace-normal break-words leading-tight">{t(tab.labelKey)}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {content[activeTab]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-body font-semibold text-[15px] text-white">{title}</h3>
      {children}
    </div>
  )
}

function RadioCard({
  selected, onClick, label, desc,
}: {
  selected: boolean
  onClick: () => void
  label: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150',
        selected
          ? 'border-green bg-green/5'
          : 'border-border bg-navy-4 hover:border-white/20',
      )}
    >
      <div
        className={cn(
          'w-4 h-4 rounded-full border-2 shrink-0 transition-all',
          selected ? 'border-green bg-green' : 'border-white-dim bg-transparent',
        )}
      />
      <div>
        <p className={cn('font-body font-medium text-[14px]', selected ? 'text-white' : 'text-white-dim')}>
          {label}
        </p>
        <p className="font-body text-[12px] text-white-dim">{desc}</p>
      </div>
    </button>
  )
}

function Toggle({
  label, desc, value, onChange,
}: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="font-body font-medium text-[14px] text-white">{label}</p>
        <p className="font-body text-[12px] text-white-dim mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          'w-11 h-6 rounded-full relative transition-all duration-200 shrink-0',
          value ? 'bg-green' : 'bg-navy-4 border border-border',
        )}
        aria-checked={value}
        role="switch"
      >
        <span
          className={cn(
            'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200',
            value ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}
