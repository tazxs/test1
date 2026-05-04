import { motion } from 'framer-motion'
import { cn } from '@utils/cn'
import { CARD_HOVER } from '@lib/motion'

export type CardVariant = 'default' | 'elevated' | 'interactive' | 'glow'

export interface CardProps {
  variant?: CardVariant
  className?: string
  children?: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  padding?: 'sm' | 'md' | 'lg' | 'none'
  onClick?: () => void
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-navy-3 border border-border',
  elevated: 'bg-navy-3 border border-border shadow-card',
  interactive: 'bg-navy-3 border border-border shadow-card cursor-pointer hover:border-white/20',
  glow: 'bg-navy-3 border-glow',
}

const PADDING_CLASSES = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-10',
}

export function Card({
  variant = 'default',
  className,
  children,
  header,
  footer,
  padding = 'md',
  onClick,
}: CardProps) {
  const baseClasses = cn(
    'rounded-2xl overflow-hidden',
    VARIANT_CLASSES[variant],
    className
  )

  const inner = (
    <>
      {header && (
        <div className="border-b border-border px-6 py-4">{header}</div>
      )}
      <div className={padding !== 'none' ? PADDING_CLASSES[padding] : ''}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-border px-6 py-4">{footer}</div>
      )}
    </>
  )

  if (variant === 'interactive') {
    return (
      <motion.div
        whileHover={CARD_HOVER.whileHover}
        className={baseClasses}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }
            : undefined
        }
      >
        {inner}
      </motion.div>
    )
  }

  return (
    <div className={baseClasses} onClick={onClick}>
      {inner}
    </div>
  )
}
