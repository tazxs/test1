import { motion } from 'framer-motion'
import { FADE_UP, STAGGER_CONTAINER } from '@lib/motion'
import { cn } from '@utils/cn'

const STEPS = [
  {
    num: '01',
    icon: '🏦',
    title: 'Подключить банк',
    description: 'Kaspi, Halyk или Forte — безопасно через Open Banking API',
  },
  {
    num: '02',
    icon: '🤖',
    title: 'AI категоризирует',
    description: 'Каждая транзакция автоматически распознаётся и категоризируется',
  },
  {
    num: '03',
    icon: '💡',
    title: 'Оптимизирует налоги',
    description: 'AI находит законные вычеты и рекомендует оптимальный режим',
  },
  {
    num: '04',
    icon: '📄',
    title: 'Подаёт декларацию',
    description: 'Формирование и отправка в eGov в один клик',
  },
] as const

export function HowItWorksSection() {
  return (
    <section className="bg-navy py-15 px-5 md:py-25 md:px-15" id="how-it-works">
      <div className="max-w-container mx-auto">
        <p className="font-mono text-[13px] uppercase tracking-[2px] text-green mb-3">
          Процесс
        </p>
        <h2
          className="font-display text-[32px] md:text-[48px] text-white mb-15"
          style={{ letterSpacing: '-1px' }}
        >
          4 шага до нулевых налоговых проблем
        </h2>

        {/* Steps grid */}
        <div className="relative">
          {/* Connector line — desktop only */}
          <div
            className="absolute hidden lg:block h-0.5 z-0"
            style={{
              top: 48,
              left: 'calc(12.5% + 20px)',
              right: 'calc(12.5% + 20px)',
              background: 'linear-gradient(90deg, #00E87A, rgba(0,232,122,0.1))',
            }}
          />

          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 relative z-10"
          >
            {STEPS.map((step) => (
              <StepCard key={step.num} step={step} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function StepCard({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <motion.div
      variants={FADE_UP}
      transition={{ duration: 0.5 }}
      className={cn(
        'group bg-navy-3 border border-transparent border-t-2 border-t-transparent',
        'rounded-2xl px-6 py-8 text-center relative',
        'hover:-translate-y-1 transition-lift',
        'hover:border-t-green',
        'hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]'
      )}
    >
      {/* Step number */}
      <p className="font-mono text-sm text-green mb-4">{step.num}</p>

      {/* Icon */}
      <div
        className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-[14px] text-2xl"
        style={{ background: 'rgba(0,232,122,0.1)' }}
        aria-hidden="true"
      >
        {step.icon}
      </div>

      {/* Title */}
      <h3 className="font-display text-[18px] text-white mb-2">{step.title}</h3>

      {/* Description */}
      <p className="font-body text-sm text-white-dim" style={{ lineHeight: 1.5 }}>
        {step.description}
      </p>
    </motion.div>
  )
}
