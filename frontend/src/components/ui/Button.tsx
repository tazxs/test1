import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: [
    'bg-green text-navy font-semibold',
    'hover:bg-green-dim',
    'shadow-glow hover:shadow-glow-strong',
    'disabled:bg-green/40 disabled:shadow-none',
  ].join(' '),
  secondary: [
    'border border-border bg-transparent text-white',
    'hover:border-white/40 hover:bg-white-ghost',
    'disabled:opacity-40',
  ].join(' '),
  ghost: [
    'bg-transparent text-white-dim',
    'hover:text-white hover:bg-white-ghost',
    'disabled:opacity-40',
  ].join(' '),
  danger: [
    'bg-red/10 text-red border border-red/20',
    'hover:bg-red/20 hover:border-red/40',
    'disabled:opacity-40',
  ].join(' '),
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-md gap-1.5',
  md: 'h-10 px-5 text-sm rounded-lg gap-2',
  lg: 'h-12 px-8 text-base rounded-xl gap-2',
}

function Spinner({ size }: { size: ButtonSize }) {
  const dim = size === 'sm' ? 14 : size === 'md' ? 16 : 18
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4"
        strokeDashoffset="10"
        opacity="0.3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled ?? loading

    return (
      <motion.button
        ref={ref}
        whileHover={isDisabled ? undefined : { scale: 1.02 }}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        disabled={isDisabled}
        className={cn(
          'relative inline-flex items-center justify-center font-body',
          'transition-hover cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/50',
          'disabled:cursor-not-allowed',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          fullWidth && 'w-full',
          className
        )}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
      >
        {loading ? (
          <Spinner size={size} />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
