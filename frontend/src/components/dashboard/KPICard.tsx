import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@utils/cn'
import { getIntlLocale } from '../../i18n'

export interface KPICardProps {
  label: string
  value: number
  /** Formatter for the displayed value (default: integer) */
  format?: (n: number) => string
  /** Static suffix appended after formatted value (e.g. "₸") */
  valueSuffix?: string
  /** Color for the value number */
  valueColor?: 'white' | 'green'
  trend?: {
    text: string
    direction?: 'up' | 'down' | 'neutral'
    /** Treat "down" as positive (e.g. tax decrease is good) */
    invertColors?: boolean
  }
}

function useCountUp(target: number, duration = 1200) {
  const [current, setCurrent] = useState(0)
  const frame = useRef<number>(0)
  const started = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) { setCurrent(0); return }

    function tick(now: number) {
      if (started.current === null) started.current = now
      const elapsed = now - started.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(target * eased))
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration])

  return current
}

function TrendArrow({ direction, positive }: { direction: 'up' | 'down' | 'neutral'; positive: boolean }) {
  if (direction === 'neutral') return null
  const isUp = direction === 'up'
  const color = positive ? 'text-green' : 'text-red'

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={cn('shrink-0', color)}
      aria-hidden="true"
    >
      {isUp ? (
        <path d="M6 2L11 8H1L6 2Z" fill="currentColor" />
      ) : (
        <path d="M6 10L1 4H11L6 10Z" fill="currentColor" />
      )}
    </svg>
  )
}

export function KPICard({
  label,
  value,
  format,
  valueSuffix,
  valueColor = 'white',
  trend,
}: KPICardProps) {
  const animatedValue = useCountUp(value)
  const formatted = format ? format(animatedValue) : animatedValue.toLocaleString(getIntlLocale())

  const trendPositive = trend
    ? trend.direction === 'neutral'
      ? true
      : trend.invertColors
        ? trend.direction === 'down'
        : trend.direction === 'up'
    : true

  return (
    <motion.div
      className="bg-navy-3 border border-border rounded-2xl p-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="font-body text-[13px] text-white-dim">{label}</p>

      <p
        className={cn(
          'font-mono font-medium text-[32px] leading-none mt-2',
          valueColor === 'green' ? 'text-green' : 'text-white',
        )}
      >
        {formatted}
        {valueSuffix != null && (
          <span className="text-[22px] ml-1 text-white-dim">{valueSuffix}</span>
        )}
      </p>

      {trend != null && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend.direction != null && trend.direction !== 'neutral' && (
            <TrendArrow direction={trend.direction} positive={trendPositive} />
          )}
          <span
            className={cn(
              'font-mono text-[13px]',
              trend.direction === 'neutral'
                ? 'text-white-dim'
                : trendPositive
                  ? 'text-green'
                  : 'text-red',
            )}
          >
            {trend.text}
          </span>
        </div>
      )}
    </motion.div>
  )
}
