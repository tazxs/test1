import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@components/ui/Button'
import { FADE_UP, STAGGER_CONTAINER, FLOAT_ANIMATION } from '@lib/motion'
import { ROUTES } from '@lib/constants'
import { cn } from '@utils/cn'

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1500, started = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!started) return
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - elapsed, 3) // ease-out cubic
      setValue(Math.round(eased * target))
      if (elapsed < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, started])
  return value
}

// ── Stats data ────────────────────────────────────────────────────────────────
const STATS = [
  { value: 500, suffix: 'K+', label: 'самозанятых в КЗ' },
  { value: 20, suffix: 'ч', label: 'экономия в квартал' },
  { value: 60, suffix: '%', label: 'переплачивают налоги' },
  { value: 1, suffix: ' клик', label: 'подача декларации' },
] as const

function StatItem({ stat, started }: { stat: (typeof STATS)[number]; started: boolean }) {
  const count = useCountUp(stat.value, 1500, started)
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-[36px] md:text-[28px] text-white leading-none">
        {count}{stat.suffix}
      </span>
      <span className="font-body text-sm text-white-dim">{stat.label}</span>
    </div>
  )
}

// ── Floating dashboard card ────────────────────────────────────────────────────
function DashboardCard() {
  return (
    <motion.div
      animate={FLOAT_ANIMATION.animate}
      transition={FLOAT_ANIMATION.transition}
      className={cn(
        'hidden lg:block w-[420px] shrink-0',
        'bg-navy-3 border border-border rounded-[20px] p-8 shadow-card'
      )}
    >
      <p className="font-body font-medium text-sm text-white-dim">Экономия этого квартала</p>
      <p className="font-mono text-[36px] font-medium text-green mt-2">34 200 ₸</p>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 bg-navy-4 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: '72%', background: 'linear-gradient(90deg, #00E87A, #00B85F)' }}
        />
      </div>

      <div className="my-5 border-t border-border" />

      {/* Status rows */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <CheckCircleIcon className="text-green shrink-0" />
          <span className="font-body text-sm text-white">Доходы категоризированы</span>
        </div>
        <div className="flex items-center gap-3">
          <ClockIcon className="text-amber shrink-0" />
          <span className="font-body text-sm text-white">Декларация: через 5 дней</span>
        </div>
        <div className="flex items-center gap-3">
          <LightbulbIcon className="text-green shrink-0" />
          <span className="font-body text-sm text-green">AI нашёл +34 200 ₸ экономии</span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Hero Section ──────────────────────────────────────────────────────────────
export function HeroSection() {
  const navigate = useNavigate()
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsStarted, setStatsStarted] = useState(false)

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsStarted(true); observer.disconnect() } },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="relative min-h-[92vh] flex items-center overflow-hidden bg-navy pt-[100px] pb-[60px] md:pt-[160px] md:pb-[80px]"
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(240,244,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(240,244,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          opacity: 0.04,
        }}
      />

      {/* Green radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: -200,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 800,
          height: 800,
          background: 'radial-gradient(circle, rgba(0,232,122,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      <div className="relative w-full max-w-wide mx-auto px-5 md:px-15 flex items-center gap-10 md:gap-20 flex-col lg:flex-row">
        {/* Left — text content */}
        <motion.div
          className="flex-1"
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
        >
          {/* Eyebrow pill */}
          <motion.div
            variants={FADE_UP}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 border rounded-full px-4 py-2"
            style={{ borderColor: 'rgba(0,232,122,0.3)', background: 'rgba(0,232,122,0.05)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-green animate-pulse"
            />
            <span className="font-mono text-[13px] text-green">AI-powered · Казахстан · СНГ</span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-[40px] md:text-[56px] lg:text-[88px] text-white mt-6 max-w-[720px]"
            style={{ lineHeight: 1.05, letterSpacing: '-2px' }}
          >
            Налоги — больше не ваша{' '}
            <span
              className="text-green"
              style={{ textShadow: '0 0 40px rgba(0,232,122,0.2)' }}
            >
              головная боль
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="font-body text-[18px] md:text-base text-white-dim mt-5 max-w-[560px]"
            style={{ lineHeight: 1.6 }}
          >
            Подключите банк → AI автоматически считает налоги, формирует декларацию
            и находит законные способы экономии
          </motion.p>

          {/* CTA row */}
          <motion.div
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center gap-4 mt-10 flex-wrap"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(ROUTES.REGISTER)}
              rightIcon={<span aria-hidden="true">→</span>}
              className="text-base px-8 py-4 rounded-xl"
            >
              Начать бесплатно
            </Button>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            ref={statsRef}
            variants={FADE_UP}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-15 pt-8 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {STATS.map((stat) => (
              <StatItem key={stat.label} stat={stat} started={statsStarted} />
            ))}
          </motion.div>
        </motion.div>

        {/* Right — floating card */}
        <DashboardCard />
      </div>
    </section>
  )
}

// ── Inline icons ───────────────────────────────────────────────────────────────
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/>
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  )
}
