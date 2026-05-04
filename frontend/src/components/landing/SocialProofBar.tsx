import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FADE_UP } from '@lib/motion'

function useCountUp(target: number, duration = 2000, started = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!started) return
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      setValue(Math.round(eased * target))
      if (elapsed < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, started])
  return value
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('ru-KZ').format(n)
}

export function SocialProofBar() {
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const count = useCountUp(12847, 2000, started)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect() } },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="bg-navy-2 border-t border-b border-border py-6 px-5 md:px-15"
    >
      <motion.div
        variants={FADE_UP}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-center gap-12 flex-wrap"
        style={{ gap: '48px' }}
      >
        {/* Kaspi */}
        <div className="flex items-center gap-3">
          <BankLogo name="Kaspi" bg="#E53935" letters="K" />
          <span className="font-body font-medium text-sm text-white-dim">Интеграция с Kaspi</span>
        </div>

        {/* eGov */}
        <div className="flex items-center gap-3">
          <BankLogo name="eGov" bg="#1565C0" letters="eG" />
          <span className="font-body font-medium text-sm text-white-dim">eGov КЗ</span>
        </div>

        {/* Halyk */}
        <div className="flex items-center gap-3">
          <BankLogo name="Halyk" bg="#2E7D32" letters="H" />
          <span className="font-body font-medium text-sm text-white-dim">Halyk Bank</span>
        </div>

        {/* Counter */}
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-green">{formatNumber(count)}</span>
          <span className="font-body font-medium text-sm text-white-dim">
            самозанятых экономят с NalogAI
          </span>
        </div>
      </motion.div>
    </div>
  )
}

function BankLogo({ name, bg, letters }: { name: string; bg: string; letters: string }) {
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs opacity-60 hover:opacity-100 transition-hover"
      style={{ background: bg }}
      aria-label={name}
    >
      {letters}
    </div>
  )
}
