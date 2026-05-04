import { forwardRef, useState } from 'react'
import { cn } from '@utils/cn'

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'search'

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputType
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** Suffix text shown inside input on the right (e.g. "₸") */
  suffix?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type = 'text',
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      suffix,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false)
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const isPassword = type === 'password'
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="font-body text-sm font-medium text-white-dim"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {/* Left icon */}
          {leftIcon && (
            <span className="absolute left-3 flex items-center text-white-dim pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            className={cn(
              'w-full h-11 font-body text-sm text-white',
              'bg-navy-4 border border-border rounded-lg',
              'placeholder:text-white/30',
              'transition-hover',
              'focus:outline-none focus:border-green/50 focus:ring-1 focus:ring-green/20',
              error != null && error !== '' && 'border-red/60 focus:border-red/60 focus:ring-red/20',
              leftIcon != null ? 'pl-10' : 'pl-4',
              (rightIcon != null || isPassword || suffix != null) && 'pr-10',
              suffix != null && 'pr-12',
              className
            )}
            {...props}
          />

          {/* Suffix */}
          {suffix && !isPassword && !rightIcon && (
            <span className="absolute right-3 font-mono text-sm text-white-dim pointer-events-none">
              {suffix}
            </span>
          )}

          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 flex items-center text-white-dim hover:text-white transition-color"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}

          {/* Right icon (non-password) */}
          {rightIcon && !isPassword && (
            <span className="absolute right-3 flex items-center text-white-dim pointer-events-none">
              {rightIcon}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="font-body text-xs text-red mt-0.5" role="alert">
            {error}
          </p>
        )}

        {/* Hint */}
        {hint && !error && (
          <p className="font-body text-xs text-white-dim mt-0.5">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

// ── Inline SVG icons (no external dep) ────────────────────────────────────────
function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
