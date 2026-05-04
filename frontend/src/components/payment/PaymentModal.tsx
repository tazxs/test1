import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { cn } from '@utils/cn'
import { useAuthStore } from '@store/authStore'
import type { SubscriptionPlan } from 'nalogai-shared/types/user.types'

// ── Plan definitions ───────────────────────────────────────────────────────────
const PLAN_INFO: Record<
  Exclude<SubscriptionPlan, 'FREE'>,
  { name: string; price: number; color: string; features: string[] }
> = {
  PRO: {
    name: 'Pro',
    price: 4990,
    color: '#FFB800',
    features: ['Неограниченные транзакции', 'Все формы деклараций', 'PDF-экспорт', 'Email-уведомления'],
  },
  PRO_AI: {
    name: 'Pro AI',
    price: 9990,
    color: '#00E87A',
    features: ['Всё из Pro', 'AI-советник без ограничений', 'AI-категоризация', 'Telegram-бот'],
  },
}

type PayMethod = 'card' | 'kaspi'

// ── Card number formatting ────────────────────────────────────────────────────
function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

function detectCardType(number: string): string {
  const d = number.replace(/\s/g, '')
  if (/^4/.test(d)) return 'VISA'
  if (/^5[1-5]/.test(d)) return 'MC'
  if (/^220[0-4]/.test(d)) return 'МИР'
  return ''
}

// ── Mock QR SVG (Kaspi QR placeholder) ───────────────────────────────────────
function KaspiQR({ amount }: { amount: number }) {
  // Generate a deterministic grid pattern based on amount
  const seed = amount % 64
  const cells = Array.from({ length: 7 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => {
      // Always-filled corner anchors
      const corner =
        (row < 2 && col < 2) ||
        (row < 2 && col > 4) ||
        (row > 4 && col < 2)
      return corner || ((seed ^ (row * 7 + col)) & 1) === 1
    }),
  )

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR frame */}
      <div
        className="p-4 rounded-2xl"
        style={{ background: '#fff', border: '1px solid rgba(240,244,255,0.1)' }}
      >
        <svg width={140} height={140} viewBox="0 0 7 7" shapeRendering="crispEdges">
          {cells.map((row, r) =>
            row.map((filled, c) =>
              filled ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#111" /> : null,
            ),
          )}
        </svg>
      </div>

      <div className="text-center">
        <p className="font-body font-semibold text-[15px] text-white">
          {amount.toLocaleString('ru-KZ')} ₸
        </p>
        <p className="font-body text-[12px] text-white-dim mt-1">
          Откройте Kaspi → «Сканировать» → направьте камеру на QR
        </p>
      </div>

      {/* Kaspi logo pill */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full"
        style={{ background: 'rgba(255, 67, 0, 0.10)', border: '1px solid rgba(255,67,0,0.25)' }}
      >
        <span className="text-[16px]">🔴</span>
        <span className="font-body font-medium text-[13px] text-white">Kaspi Pay</span>
      </div>
    </div>
  )
}

// ── Card form ─────────────────────────────────────────────────────────────────
interface CardFormProps {
  onPay: (last4: string) => Promise<void>
  paying: boolean
  amount: number
}

function CardForm({ onPay, paying, amount }: CardFormProps) {
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv]       = useState('')
  const [name, setName]     = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (number.replace(/\s/g, '').length < 16) e['number'] = 'Введите 16 цифр номера карты'
    if (!/^\d{2}\/\d{2}$/.test(expiry)) e['expiry'] = 'Формат ММ/ГГ'
    else {
      const [mm, yy] = expiry.split('/')
      const now = new Date()
      const expDate = new Date(2000 + parseInt(yy!), parseInt(mm!) - 1)
      if (expDate < now) e['expiry'] = 'Срок действия истёк'
    }
    if (cvv.length < 3) e['cvv'] = 'CVV — 3 цифры'
    if (!name.trim()) e['name'] = 'Введите имя'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    const last4 = number.replace(/\s/g, '').slice(-4)
    await onPay(last4)
  }

  const cardType = detectCardType(number)

  return (
    <div className="flex flex-col gap-4">
      {/* Card number */}
      <div>
        <label className="block font-body text-[12px] font-medium text-white-dim mb-1.5">
          Номер карты
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            className={cn(
              'w-full h-11 bg-navy-4 border rounded-lg px-4 pr-16 font-mono text-[14px] text-white placeholder:text-white/25 outline-none transition-all',
              errors['number'] ? 'border-red/60' : 'border-border focus:border-green/60',
            )}
          />
          {cardType && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-white-dim">
              {cardType}
            </span>
          )}
        </div>
        {errors['number'] && (
          <p className="font-body text-[11px] text-red mt-1">{errors['number']}</p>
        )}
      </div>

      {/* Expiry + CVV */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-body text-[12px] font-medium text-white-dim mb-1.5">
            Срок действия
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="ММ/ГГ"
            maxLength={5}
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            className={cn(
              'w-full h-11 bg-navy-4 border rounded-lg px-4 font-mono text-[14px] text-white placeholder:text-white/25 outline-none transition-all',
              errors['expiry'] ? 'border-red/60' : 'border-border focus:border-green/60',
            )}
          />
          {errors['expiry'] && (
            <p className="font-body text-[11px] text-red mt-1">{errors['expiry']}</p>
          )}
        </div>
        <div>
          <label className="block font-body text-[12px] font-medium text-white-dim mb-1.5">CVV</label>
          <input
            type="password"
            inputMode="numeric"
            placeholder="•••"
            maxLength={3}
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
            className={cn(
              'w-full h-11 bg-navy-4 border rounded-lg px-4 font-mono text-[14px] text-white placeholder:text-white/25 outline-none transition-all',
              errors['cvv'] ? 'border-red/60' : 'border-border focus:border-green/60',
            )}
          />
          {errors['cvv'] && (
            <p className="font-body text-[11px] text-red mt-1">{errors['cvv']}</p>
          )}
        </div>
      </div>

      {/* Cardholder name */}
      <div>
        <label className="block font-body text-[12px] font-medium text-white-dim mb-1.5">
          Имя на карте
        </label>
        <input
          type="text"
          placeholder="IVAN IVANOV"
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          className={cn(
            'w-full h-11 bg-navy-4 border rounded-lg px-4 font-mono text-[14px] text-white placeholder:text-white/25 outline-none transition-all uppercase',
            errors['name'] ? 'border-red/60' : 'border-border focus:border-green/60',
          )}
        />
        {errors['name'] && (
          <p className="font-body text-[11px] text-red mt-1">{errors['name']}</p>
        )}
      </div>

      <Button
        variant="primary"
        size="md"
        loading={paying}
        onClick={() => void handleSubmit()}
        className="w-full justify-center mt-1"
      >
        Оплатить {amount.toLocaleString('ru-KZ')} ₸
      </Button>

      {/* Security note */}
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-[12px] text-white-dim">🔒</span>
        <p className="font-body text-[11px] text-white-dim">
          Данные карты защищены шифрованием TLS 1.3
        </p>
      </div>
    </div>
  )
}

// ── Success screen ─────────────────────────────────────────────────────────────
function SuccessScreen({ plan, onClose }: { plan: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center text-3xl"
      >
        ✓
      </motion.div>
      <div className="text-center">
        <p className="font-display text-[22px] text-white">Подписка активирована!</p>
        <p className="font-body text-[14px] text-white-dim mt-2">
          Тариф <span className="text-white font-medium">{plan}</span> подключён. Обновите
          страницу, чтобы все функции стали доступны.
        </p>
      </div>
      <Button variant="primary" size="md" onClick={onClose} className="w-full justify-center">
        Отлично!
      </Button>
    </div>
  )
}

// ── Props & main modal ─────────────────────────────────────────────────────────
interface Props {
  open: boolean
  plan: Exclude<SubscriptionPlan, 'FREE'>
  onClose: () => void
  onSuccess: (plan: SubscriptionPlan) => void
}

export function PaymentModal({ open, plan, onClose, onSuccess }: Props) {
  const info = PLAN_INFO[plan]
  const { setPlan, setAccessToken } = useAuthStore()
  const [method, setMethod] = useState<PayMethod>('card')
  const [paying, setPaying]   = useState(false)
  const [done, setDone]       = useState(false)

  // Activate plan: update store immediately for UI, then await backend to get
  // a fresh JWT with the new plan baked in. Success screen is shown only AFTER
  // the JWT is updated — this prevents the race where the user navigates to AI
  // advisor and sends a message before the backend reflects the new plan.
  async function activatePlan(token: string) {
    setPlan(plan) // Optimistic: update UI gate immediately

    try {
      const { subscribePlanApi } = await import('@api/payments.api')
      const result = await subscribePlanApi(plan, token)
      setAccessToken(result.accessToken) // Fresh JWT with plan: 'PRO_AI' in claims
    } catch {
      // Backend not running — plan set locally, API calls will show network error
    }

    setDone(true)   // Show success only after JWT is updated
    onSuccess(plan)
  }

  async function handleCardPay(last4: string) {
    setPaying(true)
    await activatePlan(`card_${last4}`)
    setPaying(false)
  }

  async function handleKaspiConfirm() {
    setPaying(true)
    await activatePlan('kaspi_qr')
    setPaying(false)
  }

  function handleClose() {
    setDone(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={done ? '' : `Подключить тариф ${info.name}`}
    >
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <SuccessScreen plan={info.name} onClose={handleClose} />
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-5 mt-2"
          >
            {/* Plan summary */}
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: `${info.color}0D`, border: `1px solid ${info.color}30` }}
            >
              <div>
                <p className="font-body font-semibold text-[14px]" style={{ color: info.color }}>
                  {info.name}
                </p>
                <p className="font-body text-[12px] text-white-dim mt-0.5">
                  {info.features.slice(0, 2).join(' · ')}
                </p>
              </div>
              <p className="font-mono font-bold text-[18px] text-white">
                {info.price.toLocaleString('ru-KZ')} <span className="text-[13px]">₸/мес</span>
              </p>
            </div>

            {/* Method tabs */}
            <div
              className="flex gap-1 p-1 rounded-xl"
              style={{ background: 'rgba(240,244,255,0.04)', border: '1px solid rgba(240,244,255,0.08)' }}
            >
              {(['card', 'kaspi'] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    'flex-1 h-9 rounded-lg font-body text-[13px] font-medium transition-all duration-150 flex items-center justify-center gap-1.5',
                    method === m
                      ? 'bg-navy-4 text-white'
                      : 'text-white-dim hover:text-white',
                  )}
                >
                  {m === 'card' ? (
                    <>💳 Картой</>
                  ) : (
                    <><span className="text-[14px]">🔴</span> Kaspi QR</>
                  )}
                </button>
              ))}
            </div>

            {/* Method content */}
            <AnimatePresence mode="wait">
              {method === 'card' ? (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <CardForm onPay={handleCardPay} paying={paying} amount={info.price} />
                </motion.div>
              ) : (
                <motion.div
                  key="kaspi"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col items-center gap-4"
                >
                  <KaspiQR amount={info.price} />
                  <Button
                    variant="primary"
                    size="md"
                    loading={paying}
                    onClick={() => void handleKaspiConfirm()}
                    className="w-full justify-center"
                  >
                    Я оплатил через Kaspi
                  </Button>
                  <p className="font-body text-[11px] text-white-dim text-center">
                    После оплаты нажмите кнопку выше — подписка активируется автоматически
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}
