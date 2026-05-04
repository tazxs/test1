import { useState } from 'react'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { PaymentModal } from '@components/payment/PaymentModal'
import { useAuthStore, getEffectivePlan } from '@store/authStore'
import { toast } from '@store/notificationStore'
import type { SubscriptionPlan } from 'nalogai-shared/types/user.types'
import { cn } from '@utils/cn'

// ── Plan metadata ──────────────────────────────────────────────────────────────
interface PlanMeta {
  id: SubscriptionPlan
  name: string
  price: string
  priceRaw: number
  aiRequests: string
  declarations: string
  banks: string
  support: string
  badgeVariant: 'gray' | 'green' | 'amber'
  popular: boolean
  borderClass: string
}

const PLAN_META: PlanMeta[] = [
  {
    id: 'FREE',
    name: 'FREE',
    price: '0 ₸/мес',
    priceRaw: 0,
    aiRequests: '—',
    declarations: '2/год',
    banks: '1',
    support: 'Email',
    badgeVariant: 'gray',
    popular: false,
    borderClass: 'border-border',
  },
  {
    id: 'PRO',
    name: 'PRO',
    price: '4 990 ₸/мес',
    priceRaw: 4990,
    aiRequests: '✓ 50 зап/мес',
    declarations: '12/год',
    banks: '3',
    support: 'Приоритет',
    badgeVariant: 'green',
    popular: true,
    borderClass: 'border-green/40',
  },
  {
    id: 'PRO_AI',
    name: 'PRO+AI',
    price: '9 990 ₸/мес',
    priceRaw: 9990,
    aiRequests: '✓ 500 зап/мес',
    declarations: 'Безлимит',
    banks: '10',
    support: 'Персональный',
    badgeVariant: 'amber',
    popular: false,
    borderClass: 'border-amber/30',
  },
]

// ── Current plan card ──────────────────────────────────────────────────────────
interface CurrentPlanCardProps {
  plan: SubscriptionPlan
  trialEndsAt?: string | null
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function CurrentPlanCard({ plan, trialEndsAt }: CurrentPlanCardProps) {
  const meta = PLAN_META.find((p) => p.id === plan) ?? PLAN_META[0]!

  const trialDaysLeft = trialEndsAt != null ? daysUntil(trialEndsAt) : null
  const trialTotalDays = 14
  const trialProgress =
    trialDaysLeft != null
      ? Math.min(100, Math.round(((trialTotalDays - trialDaysLeft) / trialTotalDays) * 100))
      : null

  return (
    <Card variant="elevated" padding="md">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-display text-[20px] text-white">Ваш тариф</h2>
          <Badge variant={meta.badgeVariant} size="md">
            {meta.name}
          </Badge>
          {trialDaysLeft != null && trialDaysLeft > 0 && (
            <Badge variant="amber" size="sm" dot>
              Пробный период
            </Badge>
          )}
        </div>

        {/* Trial progress */}
        {trialDaysLeft != null && trialProgress != null && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-body text-[13px] text-white-dim">
                Пробный период:{' '}
                <span className="text-amber font-medium">{trialDaysLeft} дней осталось</span>
              </p>
              <p className="font-mono text-[12px] text-white-dim">{trialProgress}%</p>
            </div>
            <div className="h-1.5 bg-navy-4 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber rounded-full transition-all duration-500"
                style={{ width: `${trialProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Limits grid */}
        <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-3">
          <LimitItem label="AI запросов/мес" value={meta.aiRequests} />
          <LimitItem label="Деклараций/год" value={meta.declarations} />
          <LimitItem label="Банковских подключений" value={meta.banks} />
        </div>
      </div>
    </Card>
  )
}

function LimitItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-navy-4 rounded-xl px-4 py-3">
      <p className="font-body text-[11px] text-white-dim uppercase tracking-wide mb-1">{label}</p>
      <p className="font-mono text-[15px] text-white">{value}</p>
    </div>
  )
}

// ── Upgrade comparison table ───────────────────────────────────────────────────
interface UpgradeTableProps {
  currentPlan: SubscriptionPlan
  onUpgrade: (plan: SubscriptionPlan) => void
}

const TABLE_ROWS: { label: string; key: keyof Pick<PlanMeta, 'aiRequests' | 'declarations' | 'banks' | 'support'> }[] = [
  { label: 'AI-категоризация', key: 'aiRequests' },
  { label: 'Декларации', key: 'declarations' },
  { label: 'Банки', key: 'banks' },
  { label: 'Поддержка', key: 'support' },
]

function UpgradeTable({ currentPlan, onUpgrade }: UpgradeTableProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] text-white">Сравнение тарифов</h2>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 font-body text-[12px] font-medium text-white-dim uppercase tracking-wide w-[180px]">
                Функция
              </th>
              {PLAN_META.map((plan) => (
                <th key={plan.id} className="px-4 py-3 text-center w-[160px]">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        'font-mono text-[13px] font-semibold',
                        plan.badgeVariant === 'green' && 'text-green',
                        plan.badgeVariant === 'amber' && 'text-amber',
                        plan.badgeVariant === 'gray' && 'text-white-dim',
                      )}
                    >
                      {plan.name}
                    </span>
                    {plan.popular && (
                      <Badge variant="green" size="sm">Популярный</Badge>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Price row */}
            <tr className="border-t border-border">
              <td className="px-4 py-3 font-body text-[13px] text-white-dim">Цена</td>
              {PLAN_META.map((plan) => (
                <td key={plan.id} className={cn('px-4 py-3 text-center', plan.popular && 'bg-green/5')}>
                  <span className="font-mono text-[14px] text-white">{plan.price}</span>
                </td>
              ))}
            </tr>

            {/* Feature rows */}
            {TABLE_ROWS.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td className="px-4 py-3 font-body text-[13px] text-white-dim">{row.label}</td>
                {PLAN_META.map((plan) => (
                  <td key={plan.id} className={cn('px-4 py-3 text-center', plan.popular && 'bg-green/5')}>
                    <span
                      className={cn(
                        'font-body text-[13px]',
                        plan[row.key] === '—' ? 'text-white-dim/40' : 'text-white',
                      )}
                    >
                      {plan[row.key]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}

            {/* CTA row */}
            <tr className="border-t border-border">
              <td className="px-4 py-3" />
              {PLAN_META.map((plan) => {
                const isCurrent = plan.id === currentPlan
                const isDowngrade = plan.priceRaw < (PLAN_META.find((p) => p.id === currentPlan)?.priceRaw ?? 0)
                return (
                  <td key={plan.id} className={cn('px-4 py-3 text-center', plan.popular && 'bg-green/5')}>
                    {isCurrent ? (
                      <Badge variant="green" size="sm" dot>Активен</Badge>
                    ) : isDowngrade ? (
                      <span className="font-body text-[12px] text-white-dim/40">—</span>
                    ) : (
                      <Button
                        variant={plan.popular ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => onUpgrade(plan.id)}
                      >
                        {plan.id === 'PRO' ? 'Перейти на PRO' : 'Получить PRO+AI'}
                      </Button>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* PRO highlighted border accent */}
      <div className="rounded-2xl border border-green/20 bg-green/5 px-5 py-4 flex items-start gap-3">
        <span className="font-mono text-green text-[18px]">★</span>
        <div>
          <p className="font-body font-semibold text-[14px] text-white mb-0.5">
            Тариф PRO — самый популярный выбор
          </p>
          <p className="font-body text-[13px] text-white-dim leading-relaxed">
            Неограниченные транзакции, все формы деклараций, синхронизация с банками и
            AI-категоризация 50 транзакций в месяц. Идеально для ИП и самозанятых.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Billing history section ────────────────────────────────────────────────────
function BillingHistory() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] text-white">История платежей</h2>
      <Card variant="default" padding="lg">
        <div className="flex flex-col items-center justify-center gap-3 py-4">
          <svg
            className="w-12 h-12 text-white-dim/30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <p className="font-body text-[14px] text-white-dim">История платежей пуста</p>
          <p className="font-body text-[12px] text-white-dim/60 text-center max-w-[280px]">
            Все счета и квитанции будут отображаться здесь после первой оплаты
          </p>
        </div>
      </Card>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function Billing() {
  const authState = useAuthStore()
  const currentPlan = getEffectivePlan(authState)
  const [paymentPlan, setPaymentPlan] = useState<Exclude<SubscriptionPlan, 'FREE'> | null>(null)

  // trialEndsAt would come from user profile — not yet in shared types, so derived as null
  const trialEndsAt: string | null = null

  function handleUpgrade(plan: SubscriptionPlan) {
    if (plan === 'FREE') return
    setPaymentPlan(plan as Exclude<SubscriptionPlan, 'FREE'>)
  }

  function handlePaymentSuccess(plan: SubscriptionPlan) {
    toast.success(`Тариф ${plan} активирован!`)
    setPaymentPlan(null)
  }

  return (
    <div className="min-h-screen bg-navy px-10 py-10 max-lg:px-4 max-lg:py-6">
      <h1 className="font-display text-[28px] text-white mb-8">Тариф и оплата</h1>

      <div className="flex flex-col gap-8 max-w-[860px]">
        {/* Current plan */}
        <CurrentPlanCard plan={currentPlan} trialEndsAt={trialEndsAt} />

        {/* Upgrade table */}
        <UpgradeTable currentPlan={currentPlan} onUpgrade={handleUpgrade} />

        {/* Billing history */}
        <BillingHistory />
      </div>

      {/* Payment modal */}
      {paymentPlan != null && (
        <PaymentModal
          open={true}
          plan={paymentPlan}
          onClose={() => setPaymentPlan(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}
