import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { z } from 'zod'
import { registerApi, onboardingApi } from '@api/auth.api'
import { useAuthStore } from '@store/authStore'
import { toast } from '@store/notificationStore'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { BankConnectModal, type BankProvider } from '@components/banks/BankConnectModal'
import { ROUTES, BUSINESS_TYPE_LABELS } from '@lib/constants'
import { cn } from '@utils/cn'

// ── Step 1 schema ─────────────────────────────────────────────────────────────
const step1Schema = z
  .object({
    fullName: z.string().min(2, 'Минимум 2 символа').max(100),
    email: z.string().email('Некорректный email'),
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .regex(/[A-Z]/, 'Нужна заглавная буква')
      .regex(/[0-9]/, 'Нужна цифра'),
    confirmPassword: z.string(),
    privacyConsent: z.literal(true, {
      errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

type Step1Data = z.infer<typeof step1Schema>

// ── Progress dots ─────────────────────────────────────────────────────────────
function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {[1, 2, 3, 4].map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          {i > 0 && (
            <div
              className="w-6 h-0.5 transition-all duration-300"
              style={{ background: step > i ? 'var(--tw-color-green, #00E87A)' : undefined }}
              data-active={step > i}
            >
              <div
                className={cn(
                  'w-full h-full transition-all duration-300',
                  step > i ? 'bg-green' : 'bg-navy-4',
                )}
              />
            </div>
          )}
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-all duration-300',
              step >= s ? 'bg-green' : 'bg-navy-4',
            )}
          />
        </div>
      ))}
    </div>
  )
}

// ── Business type card ────────────────────────────────────────────────────────
const BUSINESS_OPTIONS = [
  {
    value: 'SELF_EMPLOYED' as const,
    icon: '👤',
    label: BUSINESS_TYPE_LABELS['SELF_EMPLOYED'] ?? 'Самозанятый',
    sub: 'ЕСП, минимальная отчётность',
    regime: 'ESP',
  },
  {
    value: 'SOLE_PROPRIETOR' as const,
    icon: '🏪',
    label: 'ИП',
    sub: 'Упрощённая или общая декларация',
    regime: 'SIMPLIFIED_DECLARATION',
  },
  {
    value: 'LLC' as const,
    icon: '🏢',
    label: BUSINESS_TYPE_LABELS['LLC'] ?? 'ТОО',
    sub: 'Общеустановленный режим',
    regime: 'GENERAL_REGIME',
  },
]

const REGIME_RECOMMENDATION: Record<string, string> = {
  SELF_EMPLOYED: 'Рекомендуем: ЕСП (Единый совокупный платёж). Минимальный налог для самозанятых.',
  SOLE_PROPRIETOR:
    'Рекомендуем: Упрощённая декларация (3%). Оптимальный режим для большинства ИП.',
  LLC: 'Рекомендуем: Общеустановленный режим. Обязателен для большинства ТОО.',
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Register() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const [step, setStep] = useState(1)
  const [selectedBusiness, setSelectedBusiness] = useState<string>('')
  const [iin, setIin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [connectingProvider, setConnectingProvider] = useState<BankProvider | null>(null)

  // Step 1 form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: step1Submitting },
  } = useForm<Step1Data>({ resolver: zodResolver(step1Schema) })

  // ── Step 1: Register ─────────────────────────────────────────────────────────
  async function onStep1(values: Step1Data) {
    try {
      const result = await registerApi({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
      })
      setUser(result.user, result.accessToken)
      setStep(2)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Ошибка регистрации'
      toast.error(message)
    }
  }

  // ── Step 2: Business type ────────────────────────────────────────────────────
  async function onStep2() {
    if (!selectedBusiness) {
      toast.error('Выберите тип деятельности')
      return
    }
    const option = BUSINESS_OPTIONS.find((o) => o.value === selectedBusiness)
    setIsSubmitting(true)
    try {
      await onboardingApi({
        businessType: selectedBusiness as 'SELF_EMPLOYED' | 'SOLE_PROPRIETOR' | 'LLC',
        taxRegime: (option?.regime ?? 'SIMPLIFIED_DECLARATION') as
          | 'SIMPLIFIED_DECLARATION'
          | 'GENERAL_REGIME'
          | 'PATENT'
          | 'ESP',
        iin: iin.length === 12 ? iin : undefined,
      })
      setStep(3)
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Step 3: Bank (skip) → Step 4 ────────────────────────────────────────────
  function onStep3Skip() {
    setStep(4)
  }

  // ── Step 4: Go to dashboard ──────────────────────────────────────────────────
  function onFinish() {
    void navigate(ROUTES.DASHBOARD, { replace: true })
  }

  const slideVariants = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[520px]">
        <div
          className="bg-navy-3 border border-border rounded-[20px] px-10 py-12"
          style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}
        >
          <ProgressDots step={step} />

          <AnimatePresence mode="wait">
            {/* ── Step 1 ──────────────────────────────────────────────────── */}
            {step === 1 && (
              <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                <h1 className="font-display text-[28px] text-white text-center mb-2">
                  Создать аккаунт
                </h1>
                <p className="font-body text-[15px] text-white-dim text-center mb-8">
                  Быстрая регистрация — 1 минута
                </p>

                <form onSubmit={handleSubmit(onStep1)} className="flex flex-col gap-4" noValidate>
                  <Input
                    label="Имя"
                    placeholder="Алибек Жанов"
                    error={errors.fullName?.message}
                    {...register('fullName')}
                  />
                  <Input
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                  <Input
                    type="password"
                    label="Пароль"
                    placeholder="Минимум 8 символов"
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  <Input
                    type="password"
                    label="Подтвердите пароль"
                    placeholder="Повторите пароль"
                    error={errors.confirmPassword?.message}
                    {...register('confirmPassword')}
                  />

                  {/* Privacy consent checkbox — required by RK Law "On Personal Data" */}
                  <label className="flex items-start gap-3 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 rounded border border-border bg-navy-4 accent-green cursor-pointer"
                      {...register('privacyConsent')}
                    />
                    <span className="font-body text-[13px] text-white-dim leading-snug">
                      Я даю согласие на{' '}
                      <Link
                        to={ROUTES.PRIVACY}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green hover:text-green-dim transition-colors duration-150 underline"
                      >
                        сбор и обработку персональных данных
                      </Link>{' '}
                      в соответствии с{' '}
                      <Link
                        to={ROUTES.TERMS}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green hover:text-green-dim transition-colors duration-150 underline"
                      >
                        Условиями использования
                      </Link>{' '}
                      и{' '}
                      <Link
                        to={ROUTES.PRIVACY}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green hover:text-green-dim transition-colors duration-150 underline"
                      >
                        Политикой конфиденциальности
                      </Link>
                      .
                    </span>
                  </label>
                  {errors.privacyConsent?.message && (
                    <p className="font-body text-[12px] text-red -mt-2">
                      {errors.privacyConsent.message}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full mt-2"
                    loading={step1Submitting}
                  >
                    Продолжить →
                  </Button>
                </form>

                <p className="font-body text-[14px] text-white-dim text-center mt-6">
                  Уже есть аккаунт?{' '}
                  <Link to={ROUTES.LOGIN} className="text-green hover:text-green-dim transition-colors duration-150">
                    Войти
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ── Step 2 ──────────────────────────────────────────────────── */}
            {step === 2 && (
              <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                <h1 className="font-display text-[28px] text-white text-center mb-2">
                  Тип деятельности
                </h1>
                <p className="font-body text-[15px] text-white-dim text-center mb-8">
                  Поможет подобрать оптимальный налоговый режим
                </p>

                <div className="flex flex-col gap-3 mb-6">
                  {BUSINESS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedBusiness(opt.value)}
                      className={cn(
                        'w-full text-left bg-navy-4 border rounded-[14px] p-5 cursor-pointer transition-all duration-200',
                        selectedBusiness === opt.value
                          ? 'border-green'
                          : 'border-border hover:border-white/20',
                      )}
                      style={
                        selectedBusiness === opt.value
                          ? { background: 'rgba(0,232,122,0.05)' }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{opt.icon}</span>
                        <div>
                          <p className="font-body font-semibold text-[15px] text-white">
                            {opt.label}
                          </p>
                          <p className="font-body text-[13px] text-white-dim mt-0.5">{opt.sub}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* AI recommendation */}
                {selectedBusiness !== '' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 overflow-hidden"
                  >
                    <div
                      className="px-5 py-4 rounded-[0_12px_12px_0]"
                      style={{
                        background: 'rgba(0,232,122,0.05)',
                        borderLeft: '3px solid #00E87A',
                      }}
                    >
                      <p className="font-body text-[14px] text-white">
                        🤖 {REGIME_RECOMMENDATION[selectedBusiness]}
                      </p>
                    </div>
                  </motion.div>
                )}

                <Input
                  label="ИИН (необязательно)"
                  placeholder="123456789012"
                  value={iin}
                  onChange={(e) => setIin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  hint="12 цифр"
                />

                <div className="flex items-center justify-between mt-6 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="font-body text-[14px] text-white-dim hover:text-white transition-colors duration-150"
                  >
                    Пропустить
                  </button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => void onStep2()}
                    loading={isSubmitting}
                    className="flex-1 max-w-[200px]"
                  >
                    Продолжить →
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3 ──────────────────────────────────────────────────── */}
            {step === 3 && (
              <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                <h1 className="font-display text-[28px] text-white text-center mb-2">
                  Подключить банк
                </h1>
                <p className="font-body text-[15px] text-white-dim text-center mb-8">
                  Для автоматической синхронизации транзакций
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Kaspi */}
                  <button
                    type="button"
                    onClick={() => setConnectingProvider('KASPI')}
                    className="bg-navy-4 border border-border rounded-[16px] p-6 text-center cursor-pointer hover:border-green hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="w-12 h-12 mx-auto mb-3 bg-white/10 rounded-xl flex items-center justify-center">
                      <span className="font-mono font-bold text-white text-xs">KSP</span>
                    </div>
                    <p className="font-body font-semibold text-[16px] text-white">Kaspi Business</p>
                    <p className="font-body text-[13px] text-white-dim mt-1">Подключить</p>
                  </button>

                  {/* Halyk */}
                  <button
                    type="button"
                    onClick={() => setConnectingProvider('HALYK')}
                    className="bg-navy-4 border border-border rounded-[16px] p-6 text-center cursor-pointer hover:border-green hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="w-12 h-12 mx-auto mb-3 bg-white/10 rounded-xl flex items-center justify-center">
                      <span className="font-mono font-bold text-white text-xs">HLK</span>
                    </div>
                    <p className="font-body font-semibold text-[16px] text-white">Halyk Bank</p>
                    <p className="font-body text-[13px] text-white-dim mt-1">Подключить</p>
                  </button>

                  {/* Skip */}
                  <button
                    type="button"
                    onClick={onStep3Skip}
                    className="col-span-2 border border-dashed border-border rounded-[16px] p-5 text-center cursor-pointer hover:border-white/30 transition-all duration-200"
                  >
                    <p className="font-body text-[15px] text-white-dim">
                      ⏭ Подключить позже
                    </p>
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full mt-6"
                  onClick={onStep3Skip}
                >
                  Продолжить →
                </Button>
              </motion.div>
            )}

            {/* ── Step 4 ──────────────────────────────────────────────────── */}
            {step === 4 && (
              <motion.div
                key="step4"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <h1 className="font-display text-[32px] text-white text-center mb-2">
                  Добро пожаловать! 🎉
                </h1>
                <p className="font-body text-[15px] text-white-dim text-center mb-8">
                  Вот что мы уже нашли...
                </p>

                <div
                  className="rounded-[20px] p-8 mb-8 border"
                  style={{
                    background: 'var(--navy-3, #131F35)',
                    borderColor: 'rgba(0,232,122,0.2)',
                    boxShadow: '0 0 20px rgba(0,232,122,0.1)',
                  }}
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-between">
                      <span className="font-body text-[14px] text-white-dim">
                        Ваш налоговый режим
                      </span>
                      <span className="font-body text-[13px] font-semibold text-green bg-green/10 px-3 py-1 rounded-full">
                        Упрощённый (3%)
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                      <span className="font-body text-[14px] text-white-dim">
                        Следующий дедлайн
                      </span>
                      <span className="font-body text-[13px] font-semibold text-amber">
                        15 апреля 2025
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                      <span className="font-body text-[14px] text-white-dim">
                        Потенциальная экономия
                      </span>
                      <span className="font-body text-[13px] font-semibold text-green">
                        ~25 000 ₸/квартал
                      </span>
                    </div>
                  </div>
                </div>

                <Button variant="primary" size="lg" className="w-full" onClick={onFinish}>
                  Перейти к дашборду →
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {connectingProvider != null && (
        <BankConnectModal
          open={true}
          provider={connectingProvider}
          onClose={() => setConnectingProvider(null)}
          onConnected={(_masked) => {
            setConnectingProvider(null)
            setStep(4)
          }}
        />
      )}
    </div>
  )
}
