import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@utils/cn'
import { SLIDE_DOWN, SLIDE_DOWN_CONFIG } from '@lib/motion'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  description?: string
  disabled?: boolean
}

export interface SelectProps<T extends string = string> {
  options: SelectOption<T>[]
  value: T | null
  onChange: (value: T) => void
  placeholder?: string
  label?: string
  error?: string
  hint?: string
  disabled?: boolean
  className?: string
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  label,
  error,
  hint,
  disabled = false,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? null

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const handleSelect = (option: SelectOption<T>) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)} ref={containerRef}>
      {label && (
        <label className="font-body text-sm font-medium text-white-dim">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'w-full h-11 flex items-center justify-between gap-2',
            'px-4 font-body text-sm rounded-lg',
            'bg-navy-4 border border-border',
            'transition-hover focus:outline-none focus:border-green/50 focus:ring-1 focus:ring-green/20',
            error && 'border-red/60',
            disabled && 'opacity-50 cursor-not-allowed',
            open && 'border-green/50 ring-1 ring-green/20'
          )}
        >
          <span className={cn(selected ? 'text-white' : 'text-white/30')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronIcon open={open} />
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.ul
              variants={SLIDE_DOWN}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={SLIDE_DOWN_CONFIG}
              role="listbox"
              className={cn(
                'absolute z-40 w-full mt-1',
                'bg-navy-3 border border-border rounded-xl',
                'shadow-card overflow-hidden',
                'max-h-60 overflow-y-auto'
              )}
            >
              {options.map((option) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    'flex flex-col gap-0.5 px-4 py-3',
                    'font-body text-sm cursor-pointer',
                    'transition-hover',
                    option.disabled
                      ? 'text-white-dim opacity-50 cursor-not-allowed'
                      : 'text-white hover:bg-white-ghost',
                    option.value === value && 'text-green bg-green/5'
                  )}
                >
                  <span>{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-white-dim">{option.description}</span>
                  )}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <p className="font-body text-xs text-red mt-0.5" role="alert">{error}</p>
      )}
      {hint && !error && (
        <p className="font-body text-xs text-white-dim mt-0.5">{hint}</p>
      )}
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <motion.svg
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.2 }}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white-dim shrink-0"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </motion.svg>
  )
}
