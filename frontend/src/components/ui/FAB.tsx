import { motion } from 'framer-motion'
import { cn } from '@utils/cn'

interface FABProps {
  onClick: () => void
  label?: string
  className?: string
}

/** Floating Action Button — mobile only (hidden on lg+) */
export function FAB({ onClick, label = 'Добавить', className }: FABProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
      aria-label={label}
      className={cn(
        'lg:hidden',
        'fixed right-5 z-40',
        // Position above bottom tab bar (80px) + 16px gap
        'bottom-[calc(80px+env(safe-area-inset-bottom,0px)+16px)]',
        'w-14 h-14 rounded-full',
        'bg-green text-navy',
        'flex items-center justify-center',
        'shadow-glow-strong',
        'transition-shadow duration-200',
        className,
      )}
    >
      <svg
        className="w-7 h-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </motion.button>
  )
}
