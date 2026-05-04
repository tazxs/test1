import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@utils/cn'
import { BACKDROP, MODAL_CONTENT, MODAL_TRANSITION } from '@lib/motion'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: ModalSize
  children?: React.ReactNode
  footer?: React.ReactNode
  /** Prevent closing on overlay click */
  preventClose?: boolean
  className?: string
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  preventClose = false,
  className,
}: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, preventClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const portal = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            variants={BACKDROP}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
            onClick={preventClose ? undefined : onClose}
          />

          {/* Content */}
          <motion.div
            variants={MODAL_CONTENT}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={MODAL_TRANSITION}
            className={cn(
              'relative w-full bg-navy-3 border border-border rounded-2xl shadow-card',
              'flex flex-col max-h-[90vh]',
              SIZE_CLASSES[size],
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-describedby={description ? 'modal-description' : undefined}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border shrink-0">
                <div>
                  {title && (
                    <h2
                      id="modal-title"
                      className="font-display text-lg text-white"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p
                      id="modal-description"
                      className="font-body text-sm text-white-dim mt-1"
                    >
                      {description}
                    </p>
                  )}
                </div>
                {!preventClose && (
                  <button
                    onClick={onClose}
                    className={cn(
                      'shrink-0 w-8 h-8 flex items-center justify-center rounded-lg',
                      'text-white-dim hover:text-white hover:bg-white-ghost',
                      'transition-hover'
                    )}
                    aria-label="Закрыть"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-border shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return createPortal(portal, document.body)
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
