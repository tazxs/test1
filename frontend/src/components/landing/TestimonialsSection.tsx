import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FADE_UP, STAGGER_CONTAINER } from '@lib/motion'
import { cn } from '@utils/cn'

const TESTIMONIALS = [
  {
    text: 'Раньше тратил 2 дня на отчётность каждый квартал. Теперь — 10 минут. AI нашёл вычеты, о которых я даже не знал.',
    name: 'Аслан К.',
    role: 'Самозанятый, Алматы',
    avatarColor: '#00E87A',
    initials: 'А',
  },
  {
    text: 'Подключил Kaspi — все транзакции автоматически. Декларация формируется сама. Экономлю ~40 000₸ в квартал.',
    name: 'Динара М.',
    role: 'ИП, маркетплейс продавец',
    avatarColor: '#FFB800',
    initials: 'Д',
  },
  {
    text: 'Как бухгалтер, рекомендую клиентам. Точные расчёты, всегда актуальные ставки. Экономит и моё время тоже.',
    name: 'Бекзат Т.',
    role: 'Бухгалтер-аутсорсер',
    avatarColor: '#4D7CFE',
    initials: 'Б',
  },
] as const

function Stars() {
  return (
    <div className="flex gap-1 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#FFB800" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  )
}

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startAutoRotate = () => {
    intervalRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % TESTIMONIALS.length)
    }, 5000)
  }

  useEffect(() => {
    startAutoRotate()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const handleDotClick = (i: number) => {
    setActiveIndex(i)
    if (intervalRef.current) clearInterval(intervalRef.current)
    startAutoRotate()
  }

  return (
    <section className="bg-navy-2 py-15 px-5 md:py-20 md:px-15">
      <div className="max-w-container mx-auto">
        <h2
          className="font-display text-[32px] md:text-[48px] text-white text-center"
          style={{ letterSpacing: '-1px' }}
        >
          Что говорят наши пользователи
        </h2>

        {/* Desktop — 3-col grid */}
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="hidden md:hidden lg:grid grid-cols-3 gap-6 mt-12"
        >
          {TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.name} testimonial={t} />
          ))}
        </motion.div>

        {/* Mobile — carousel */}
        <div className="lg:hidden mt-12">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
              >
                <TestimonialCard testimonial={TESTIMONIALS[activeIndex]} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => handleDotClick(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-hover',
                  i === activeIndex ? 'bg-green w-5' : 'bg-white-ghost'
                )}
                aria-label={`Отзыв ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof TESTIMONIALS)[number]
}) {
  return (
    <motion.div
      variants={FADE_UP}
      transition={{ duration: 0.5 }}
      className="bg-navy-3 border border-border rounded-2xl p-8"
    >
      <Stars />
      <p className="font-body text-[15px] text-white mb-6" style={{ lineHeight: 1.6 }}>
        {testimonial.text}
      </p>
      <div className="border-t border-border mb-5" />
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-body font-bold text-base text-white shrink-0"
          style={{ background: testimonial.avatarColor }}
        >
          {testimonial.initials}
        </div>
        <div>
          <p className="font-body font-semibold text-sm text-white">{testimonial.name}</p>
          <p className="font-body text-[13px] text-white-dim">{testimonial.role}</p>
        </div>
      </div>
    </motion.div>
  )
}
