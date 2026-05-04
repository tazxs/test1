import { motion } from 'framer-motion'
import { FADE_UP, STAGGER_CONTAINER } from '@lib/motion'
import { cn } from '@utils/cn'

const SAVINGS_ROWS = [
  { label: 'Вычет за оборудование', amount: '12 400 ₸' },
  { label: 'Оптимизация режима', amount: '8 200 ₸' },
  { label: 'Расходы на транспорт', amount: '6 800 ₸' },
  { label: 'Вычет за обучение', amount: '6 800 ₸' },
] as const

const FEATURE_CARDS = [
  {
    icon: '📤',
    title: 'Загрузите выписку банка',
    description: 'Загрузите CSV или PDF-выписку — AI автоматически разберёт транзакции и категоризирует доходы',
  },
  {
    icon: '🔔',
    title: 'Умные напоминания',
    description: 'Telegram и email уведомления за 14, 7, 2 и 1 день до налогового дедлайна',
  },
  {
    icon: '📊',
    title: 'Аналитика доходов',
    description: 'Наглядные графики доходов, расходов и налоговой нагрузки по месяцам и кварталам',
  },
  {
    icon: '🏦',
    title: 'Open Banking API',
    description: 'Безопасное подключение Kaspi, Halyk и Forte — транзакции синхронизируются автоматически',
  },
  {
    icon: '⚖️',
    title: 'Актуальное законодательство',
    description: 'База знаний обновляется при каждом изменении налогового кодекса РК',
  },
] as const

export function FeaturesSection() {
  return (
    <section className="bg-navy-2 py-15 px-5 md:py-25 md:px-15" id="features">
      <div className="max-w-container mx-auto">
        <p className="font-mono text-[13px] uppercase tracking-[2px] text-green mb-3">
          Возможности
        </p>
        <h2
          className="font-display text-[32px] md:text-[48px] text-white mb-15"
          style={{ letterSpacing: '-1px' }}
        >
          Всё, что нужно для налоговой свободы
        </h2>

        {/* Feature grid */}
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          {/* Card 1 — AI Advisor (spans 2 columns) */}
          <motion.div
            variants={FADE_UP}
            transition={{ duration: 0.5 }}
            className="col-span-1 lg:col-span-2 bg-navy-3 border border-border rounded-[20px] p-10 shadow-card"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
              {/* Left */}
              <div>
                <span
                  className="inline-block font-mono text-[11px] uppercase tracking-[1px] text-green px-2.5 py-1 rounded-md"
                  style={{ background: 'rgba(0,232,122,0.1)' }}
                >
                  AI СОВЕТНИК
                </span>
                <h3 className="font-display text-[28px] text-white mt-4">
                  Персональный налоговый AI-советник
                </h3>
                <p className="font-body text-[15px] text-white-dim mt-3" style={{ lineHeight: 1.6 }}>
                  Анализирует ваши транзакции и находит законные способы снизить налоговую нагрузку
                </p>
              </div>

              {/* Right — savings table */}
              <div className="bg-navy-4 rounded-xl p-6">
                {SAVINGS_ROWS.map((row, i) => (
                  <div
                    key={row.label}
                    className={cn(
                      'flex justify-between items-center py-2.5',
                      i < SAVINGS_ROWS.length - 1 && 'border-b border-border'
                    )}
                  >
                    <span className="font-body text-sm text-white-dim">{row.label}</span>
                    <span className="font-mono text-sm text-green">{row.amount}</span>
                  </div>
                ))}
                {/* Total */}
                <div className="flex justify-between items-center pt-3 mt-1">
                  <span className="font-body font-bold text-base text-white">Итого экономия</span>
                  <span className="font-mono font-medium text-[18px] text-green">34 200 ₸</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Cards 2–6 */}
          {FEATURE_CARDS.map((card) => (
            <FeatureCard key={card.title} card={card} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function FeatureCard({ card }: { card: (typeof FEATURE_CARDS)[number] }) {
  return (
    <motion.div
      variants={FADE_UP}
      transition={{ duration: 0.5 }}
      className={cn(
        'bg-navy-3 border border-border rounded-2xl p-8',
        'hover:-translate-y-1 transition-lift',
        'hover:border-green/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]'
      )}
    >
      {/* Icon */}
      <div
        className="w-12 h-12 flex items-center justify-center rounded-[14px] text-2xl mb-5"
        style={{ background: '#1A2A47' }}
        aria-hidden="true"
      >
        {card.icon}
      </div>

      <h3 className="font-display text-[20px] text-white mb-2">{card.title}</h3>
      <p className="font-body text-sm text-white-dim" style={{ lineHeight: 1.5 }}>
        {card.description}
      </p>
    </motion.div>
  )
}
