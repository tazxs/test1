import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@components/ui/Button'
import { FADE_UP, STAGGER_CONTAINER } from '@lib/motion'
import { ROUTES } from '@lib/constants'

const TRUST_BADGES = [
  { icon: '🔒', label: '256-bit шифрование' },
  { icon: '✓', label: 'Сертификат eGov' },
  { icon: '🏦', label: 'Open Banking' },
  { icon: '📱', label: 'Доступ 24/7' },
  { icon: '⭐', label: '4.9 рейтинг' },
] as const

export function CTASection() {
  const navigate = useNavigate()

  return (
    <section className="relative bg-navy py-15 px-5 md:py-25 md:px-15 text-center overflow-hidden">
      {/* Green glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(0,232,122,0.06) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="relative max-w-narrow mx-auto">
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.h2
            variants={FADE_UP}
            transition={{ duration: 0.5 }}
            className="font-display text-[36px] md:text-[52px] text-white"
            style={{ letterSpacing: '-1px' }}
          >
            Первая декларация за{' '}
            <span className="text-green">3 минуты</span>
          </motion.h2>

          <motion.p
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-body text-[18px] text-white-dim mt-4 max-w-[520px] mx-auto"
            style={{ lineHeight: 1.6 }}
          >
            Присоединяйтесь к тысячам предпринимателей, которые уже экономят время и деньги
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center justify-center gap-4 mt-10 flex-wrap"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(ROUTES.REGISTER)}
              rightIcon={<span aria-hidden="true">→</span>}
              className="text-base px-8"
            >
              Начать бесплатно
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="text-base px-8"
              onClick={() => window.open('https://t.me/nalogai', '_blank', 'noopener,noreferrer')}
            >
              Связаться с нами
            </Button>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-6 mt-10 flex-wrap"
          >
            {TRUST_BADGES.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2">
                <span className="text-white-dim text-base" aria-hidden="true">{badge.icon}</span>
                <span className="font-body text-[13px] text-white-dim">{badge.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
