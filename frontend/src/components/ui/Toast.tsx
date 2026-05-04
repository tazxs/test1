import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@utils/cn'
import { TOAST_VARIANTS, TOAST_TRANSITION } from '@lib/motion'
import { useNotificationStore } from '@store/notificationStore'
import type { Toast, ToastType } from '@store/notificationStore'
import { TOAST_DURATION_MS } from '@lib/constants'

// ── Individual toast item ─────────────────────────────────────────────────────
interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const TYPE_CONFIG: Record<
  ToastType,
  { icon: React.ReactNode; bgClass: string; borderClass: string; textClass: string }
> = {
  success: {
    icon: <SuccessIcon />,
    bgClass: 'bg-green/10',
    borderClass: 'border-green/20',
    textClass: 'text-green',
  },
  error: {
    icon: <ErrorIcon />,
    bgClass: 'bg-red/10',
    borderClass: 'border-red/20',
    textClass: 'text-red',
  },
  warning: {
    icon: <WarningIcon />,
    bgClass: 'bg-amber/10',
    borderClass: 'border-amber/20',
    textClass: 'text-amber',
  },
  info: {
    icon: <InfoIcon />,
    bgClass: 'bg-white-ghost',
    borderClass: 'border-border',
    textClass: 'text-white-dim',
  },
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = TYPE_CONFIG[toast.type]
  const duration = toast.duration ?? TOAST_DURATION_MS

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, duration, onDismiss])

  return (
    <motion.div
      layout
      variants={TOAST_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={TOAST_TRANSITION}
      className={cn(
        'relative w-full max-w-sm flex items-start gap-3',
        'bg-navy-3 border rounded-xl p-4 shadow-card',
        config.borderClass
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Colored icon */}
      <div
        className={cn(
          'shrink-0 w-8 h-8 flex items-center justify-center rounded-lg',
          config.bgClass,
          config.textClass
        )}
      >
        {config.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="font-body text-sm font-medium text-white leading-snug">
          {toast.message}
        </p>
        {toast.description && (
          <p className="font-body text-xs text-white-dim mt-1 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-white-dim hover:text-white transition-color mt-0.5"
        aria-label="Закрыть уведомление"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        style={{ originX: 0 }}
        className={cn(
          'absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl',
          toast.type === 'success' && 'bg-green/40',
          toast.type === 'error' && 'bg-red/40',
          toast.type === 'warning' && 'bg-amber/40',
          toast.type === 'info' && 'bg-white/20'
        )}
      />
    </motion.div>
  )
}

// ── Toast container — mount this once in App.tsx ──────────────────────────────
export function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore()

  return createPortal(
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none"
      aria-label="Уведомления"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full max-w-sm">
            <ToastItem toast={t} onDismiss={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  )
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}
