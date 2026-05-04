import { cn } from '@utils/cn'

export interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

export function Skeleton({ className, width, height, rounded = 'md' }: SkeletonProps) {
  const ROUNDED: Record<string, string> = {
    sm: 'rounded-sm',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    '2xl': 'rounded-3xl',
    full: 'rounded-full',
  }

  return (
    <div
      className={cn('skeleton', ROUNDED[rounded], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  )
}

// ── Composed skeleton shapes ───────────────────────────────────────────────────

/** KPI card skeleton */
export function KPICardSkeleton() {
  return (
    <div className="bg-navy-3 border border-border rounded-2xl p-6 flex flex-col gap-3">
      <Skeleton height={14} width="60%" />
      <Skeleton height={36} width="80%" rounded="lg" />
      <Skeleton height={12} width="40%" />
    </div>
  )
}

/** Transaction row skeleton */
export function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
      <Skeleton width={40} height={40} rounded="lg" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton height={14} width="50%" />
        <Skeleton height={12} width="30%" />
      </div>
      <Skeleton height={14} width={80} />
      <Skeleton height={24} width={80} rounded="md" />
    </div>
  )
}

/** Declaration row skeleton */
export function DeclarationRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
      <Skeleton height={14} width="20%" />
      <Skeleton height={24} width={80} rounded="md" />
      <Skeleton height={14} width="15%" />
      <Skeleton height={14} width="15%" />
    </div>
  )
}

/** Chart skeleton */
export function ChartSkeleton() {
  return (
    <div className="bg-navy-3 border border-border rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton height={20} width="30%" />
        <Skeleton height={32} width={120} rounded="lg" />
      </div>
      <div className="flex items-end gap-3 h-48">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            height={`${40 + (i % 3) * 30}%`}
            rounded="sm"
          />
        ))}
      </div>
    </div>
  )
}

/** Text block skeleton */
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  )
}
