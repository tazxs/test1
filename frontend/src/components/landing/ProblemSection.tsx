import { motion } from 'framer-motion'
import { FADE_UP, STAGGER_CONTAINER } from '@lib/motion'

const PROBLEMS = [
  {
    icon: '⏰',
    title: '8–20 часов в квартал',
    description:
      'Столько времени средний ИП тратит на подготовку налоговой отчётности каждые 3 месяца',
  },
  {
    icon: '💸',
    title: 'До 300$/мес на бухгалтера',
    description:
      'Именно столько платит микробизнес за аутсорсинг бухгалтерии — при обороте до 5 млн ₸',
  },
  {
    icon: '📉',
    title: '60% переплачивают налоги',
    description:
      'Большинство самозанятых не знают о законных вычетах и выбирают неоптимальный налоговый режим',
  },
] as const

export function ProblemSection() {
  return (
    <section className="bg-navy-2 py-15 px-5 md:py-25 md:px-15">
      <div className="max-w-container mx-auto">
        {/* Eyebrow */}
        <p className="font-mono text-[13px] uppercase tracking-[2px] text-green mb-3">
          Проблема
        </p>

        {/* Title */}
        <h2
          className="font-display text-[32px] md:text-[48px] text-white max-w-[600px] mb-15"
          style={{ letterSpacing: '-1px' }}
        >
          Почему это важно прямо сейчас
        </h2>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-20">
          {/* Left — problem cards */}
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="flex flex-col"
          >
            {PROBLEMS.map((problem) => (
              <motion.div
                key={problem.title}
                variants={FADE_UP}
                transition={{ duration: 0.5 }}
                className="flex gap-5 items-start mb-8 last:mb-0"
              >
                {/* Icon circle */}
                <div
                  className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl text-xl"
                  style={{ background: 'rgba(255,77,77,0.1)' }}
                  aria-hidden="true"
                >
                  {problem.icon}
                </div>

                {/* Text */}
                <div>
                  <h3 className="font-body font-semibold text-[18px] text-white mb-2">
                    {problem.title}
                  </h3>
                  <p className="font-body text-[15px] text-white-dim" style={{ lineHeight: 1.6 }}>
                    {problem.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Right — visual stats card */}
          <motion.div
            variants={FADE_UP}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-navy-3 border border-border rounded-[20px] p-10 shadow-card"
          >
            {/* Big red number */}
            <div>
              <p className="font-display text-[64px] text-red leading-none">16 часов</p>
              <p className="font-body text-base text-white-dim mt-1">/квартал на налоги</p>
            </div>

            <div className="my-6 border-t border-border" />

            {/* Middle stats */}
            <div className="flex gap-10">
              <div>
                <p className="font-display text-[28px] text-amber leading-none">≈ $1 200/год</p>
                <p className="font-body text-sm text-white-dim mt-1">на бухгалтера</p>
              </div>
              <div>
                <p className="font-display text-[28px] text-red leading-none">60%</p>
                <p className="font-body text-sm text-white-dim mt-1">переплата</p>
              </div>
            </div>

            <div className="my-6 border-t border-border" />

            {/* With NalogAI box */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'rgba(0,232,122,0.05)', border: '1px solid rgba(0,232,122,0.15)' }}
            >
              <p className="font-body font-semibold text-[15px] text-green mb-3">С NalogAI:</p>
              <div className="flex flex-col gap-2">
                {[
                  '✓ 3 минуты вместо 16 часов',
                  '✓ $9.99/мес вместо $300',
                  '✓ До -30% налоговой нагрузки',
                ].map((item) => (
                  <p key={item} className="font-body text-sm text-white">{item}</p>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
