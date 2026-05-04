import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@components/ui/Button'
import { FADE_UP, STAGGER_CONTAINER } from '@lib/motion'
import { ROUTES } from '@lib/constants'
import { cn } from '@utils/cn'

// ── Toggle ────────────────────────────────────────────────────────────────────
function BillingToggle({
  annual,
  onChange,
}: {
  annual: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-center gap-3 mt-10">
      <span
        className={cn(
          'font-body font-medium text-sm',
          !annual ? 'text-white' : 'text-white-dim'
        )}
      >
        Ежемесячно
      </span>

      {/* Toggle track */}
      <button
        type="button"
        onClick={() => onChange(!annual)}
        role="switch"
        aria-checked={annual}
        className={cn(
          'relative w-10 h-[22px] rounded-full transition-hover overflow-hidden',
          annual ? 'bg-green' : 'bg-navy-4'
        )}
      >
        <motion.span
          animate={{ x: annual ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow"
        />
      </button>

      <span
        className={cn(
          'font-body font-medium text-sm',
          annual ? 'text-white' : 'text-white-dim'
        )}
      >
        Ежегодно
      </span>

      {/* Discount badge */}
      <span
        className="font-mono font-medium text-[12px] text-green px-2 py-0.5 rounded-md"
        style={{ background: 'rgba(0,232,122,0.1)' }}
      >
        -20%
      </span>
    </div>
  )
}

// ── Plan data ─────────────────────────────────────────────────────────────────
const FREE_FEATURES = [
  'До 50 транзакций/мес',
  'Ручной ввод доходов',
  'Базовый калькулятор налогов',
  '1 налоговая декларация',
  'Email напоминания',
]

const PRO_FEATURES = [
  'Безлимитные транзакции',
  'Подключение Kaspi и Halyk',
  'Авто-категоризация AI',
  'Безлимитные декларации',
  'PDF-генерация',
  'Telegram + Email напоминания',
]

const PRO_AI_FEATURES = [
  'Всё из тарифа Pro',
  'AI налоговый советник',
  'Персональные оптимизации',
  'Подача в eGov в 1 клик',
  'Приоритетная поддержка',
]

// ── Pricing Section ───────────────────────────────────────────────────────────
export function PricingSection() {
  const [annual, setAnnual] = useState(false)
  const navigate = useNavigate()

  return (
    <section className="bg-navy py-15 px-5 md:py-25 md:px-15 text-center" id="pricing">
      <div className="max-w-container mx-auto">
        <p className="font-mono text-[13px] uppercase tracking-[2px] text-green mb-3">
          Тарифы
        </p>
        <h2
          className="font-display text-[32px] md:text-[48px] text-white"
          style={{ letterSpacing: '-1px' }}
        >
          Прозрачные цены
        </h2>
        <p className="font-body text-[18px] text-white-dim mt-3">
          Начните бесплатно — обновитесь когда будете готовы
        </p>

        <BillingToggle annual={annual} onChange={setAnnual} />

        {/* Cards grid */}
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 gap-6 mt-10 max-w-[960px] mx-auto lg:grid-cols-3"
        >
          {/* FREE */}
          <motion.div
            variants={FADE_UP}
            transition={{ duration: 0.5 }}
            className="bg-navy-3 border border-border rounded-[20px] px-8 py-10 flex flex-col text-left"
          >
            <PlanHeader
              name="Бесплатный"
              price={null}
              monthlyFallback="Бесплатно"
              annual={annual}
              annualPrice={null}
            />
            <p className="font-body text-sm text-white-dim mt-2">Для знакомства с платформой</p>
            <FeatureList features={FREE_FEATURES} />
            <div className="mt-auto pt-8">
              <button
                onClick={() => navigate(ROUTES.REGISTER)}
                className={cn(
                  'w-full py-3.5 rounded-xl font-body font-semibold text-sm',
                  'border border-border bg-transparent text-white',
                  'hover:bg-white-ghost transition-hover'
                )}
              >
                Начать бесплатно
              </button>
            </div>
          </motion.div>

          {/* PRO */}
          <motion.div
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative bg-navy-3 rounded-[20px] px-8 py-10 flex flex-col text-left lg:scale-[1.02]"
            style={{
              border: '1px solid rgba(0,232,122,0.3)',
              boxShadow: '0 0 20px rgba(0,232,122,0.1)',
            }}
          >
            {/* Popular badge */}
            <div
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full font-mono font-medium text-[12px] uppercase tracking-[1px]"
              style={{ background: '#00E87A', color: '#060C1A' }}
            >
              Популярный
            </div>

            <PlanHeader
              name="Про"
              price={9.99}
              annual={annual}
              annualPrice={7.99}
            />
            <p className="font-body text-sm text-white-dim mt-2">Для активных предпринимателей</p>
            <FeatureList features={PRO_FEATURES} />
            <div className="mt-auto pt-8">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate(ROUTES.REGISTER)}
              >
                Попробовать 14 дней бесплатно
              </Button>
            </div>
          </motion.div>

          {/* PRO+AI */}
          <motion.div
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-navy-3 border border-border rounded-[20px] px-8 py-10 flex flex-col text-left"
          >
            <PlanHeader
              name="Про + AI"
              price={19.99}
              annual={annual}
              annualPrice={15.99}
            />
            <p className="font-body text-sm text-white-dim mt-2">Максимальная автоматизация</p>
            <FeatureList features={PRO_AI_FEATURES} />
            <div className="mt-auto pt-8">
              <button
                onClick={() => navigate(ROUTES.REGISTER)}
                className={cn(
                  'w-full py-3.5 rounded-xl font-body font-semibold text-sm',
                  'border border-border bg-transparent text-white',
                  'hover:bg-white-ghost transition-hover'
                )}
              >
                Начать с AI-советником
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PlanHeader({
  name,
  price,
  monthlyFallback,
  annual,
  annualPrice,
}: {
  name: string
  price: number | null
  monthlyFallback?: string
  annual: boolean
  annualPrice: number | null
}) {
  const displayPrice = annual && annualPrice !== null ? annualPrice : price

  return (
    <div>
      <p className="font-body font-semibold text-sm uppercase tracking-[1px] text-white-dim">
        {name}
      </p>
      <div className="flex items-end gap-2 mt-3">
        {price === null ? (
          <span className="font-display text-[48px] text-white leading-none">
            {monthlyFallback}
          </span>
        ) : (
          <>
            <span className="font-display text-[48px] text-green leading-none">
              ${displayPrice}
            </span>
            {annual && price !== null && (
              <span className="font-body text-sm text-white-dim line-through mb-2">
                ${price}
              </span>
            )}
            <span className="font-body text-base text-white-dim mb-2">/мес</span>
          </>
        )}
      </div>
    </div>
  )
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <ul className="mt-8 flex-1 flex flex-col gap-3.5">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00E87A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="font-body text-sm text-white">{f}</span>
        </li>
      ))}
    </ul>
  )
}
