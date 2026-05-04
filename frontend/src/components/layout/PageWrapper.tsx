import { motion } from 'framer-motion'
import { cn } from '@utils/cn'
import { PAGE_TRANSITION, PAGE_TRANSITION_CONFIG } from '@lib/motion'
import { BottomTabBar } from './BottomTabBar'

export interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  /** Max width variant */
  width?: 'default' | 'wide' | 'narrow'
  /** Vertical padding */
  noPadding?: boolean
}

const WIDTH_CLASSES = {
  default: 'max-w-container',
  wide: 'max-w-wide',
  narrow: 'max-w-narrow',
}

export function PageWrapper({
  children,
  className,
  width = 'default',
  noPadding = false,
}: PageWrapperProps) {
  return (
    <motion.div
      variants={PAGE_TRANSITION}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={PAGE_TRANSITION_CONFIG}
      className={cn(
        'w-full mx-auto',
        WIDTH_CLASSES[width],
        !noPadding && 'px-5 md:px-15 py-8 md:py-12',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

/** App shell layout: sidebar + main content */
export interface AppLayoutProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
}

export function AppLayout({ children, sidebar }: AppLayoutProps) {
  return (
    <div className="min-h-dvh bg-navy flex">
      {sidebar}
      <main
        className={cn(
          'flex-1 min-w-0',
          'lg:pl-60',      // sidebar width on desktop
          'pb-20 lg:pb-0', // space for bottom tab bar on mobile
        )}
      >
        {children}
      </main>
      <BottomTabBar />
    </div>
  )
}
