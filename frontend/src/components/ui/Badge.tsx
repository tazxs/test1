import { cn } from '@utils/cn'
import { useTranslation } from 'react-i18next'
import type { TransactionCategory } from 'nalogai-shared/types/transaction.types'
import type { DeclarationStatus } from 'nalogai-shared/types/declaration.types'

export type BadgeVariant =
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'gray'
  | 'ghost'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green: 'bg-green/10 text-green border border-green/20',
  amber: 'bg-amber/10 text-amber border border-amber/20',
  red: 'bg-red/10 text-red border border-red/20',
  blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  gray: 'bg-white-ghost text-white-dim border border-border',
  ghost: 'bg-transparent text-white-dim border border-border',
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5 rounded-sm',
  md: 'text-xs px-3 py-1 rounded-md',
}

export function Badge({
  variant = 'gray',
  size = 'md',
  children,
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-body font-medium whitespace-nowrap',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'green' && 'bg-green',
            variant === 'amber' && 'bg-amber',
            variant === 'red' && 'bg-red',
            variant === 'blue' && 'bg-blue-400',
            variant === 'gray' && 'bg-white-dim',
            variant === 'ghost' && 'bg-white-dim'
          )}
        />
      )}
      {children}
    </span>
  )
}

// ── Specialized badge: Transaction category ───────────────────────────────────
const CATEGORY_BADGE_VARIANT: Partial<Record<TransactionCategory, BadgeVariant>> = {
  SERVICES_INCOME:       'green',
  GOODS_INCOME:          'green',
  RENT_INCOME:           'green',
  CONSULTING_INCOME:     'green',
  FREELANCE_INCOME:      'green',
  DIVIDEND_INCOME:       'green',
  INTEREST_INCOME:       'green',
  ASSET_SALE_INCOME:     'green',
  OTHER_INCOME:          'green',
  OFFICE_EXPENSES:       'amber',
  EQUIPMENT_EXPENSES:    'amber',
  MARKETING_EXPENSES:    'amber',
  SALARY_EXPENSES:       'amber',
  TRANSPORT_EXPENSES:    'amber',
  UTILITIES_EXPENSES:    'amber',
  INSURANCE_EXPENSES:    'amber',
  TAX_EXPENSES:          'amber',
  BANK_EXPENSES:         'amber',
  REPAIR_EXPENSES:       'amber',
  SUBSCRIPTION_EXPENSES: 'amber',
  OTHER_EXPENSES:        'gray',
  UNCATEGORIZED:         'red',
}

export interface CategoryBadgeProps {
  category: TransactionCategory
  size?: BadgeSize
  className?: string
}

export function CategoryBadge({ category, size, className }: CategoryBadgeProps) {
  const { t } = useTranslation()

  return (
    <Badge
      variant={CATEGORY_BADGE_VARIANT[category] ?? 'gray'}
      size={size}
      className={className}
    >
      {t(`transactions.category.${category}`)}
    </Badge>
  )
}

// ── Specialized badge: Declaration status ─────────────────────────────────────
const STATUS_BADGE_VARIANT: Record<DeclarationStatus, BadgeVariant> = {
  DRAFT: 'gray',
  READY: 'amber',
  SUBMITTED: 'blue',
  ACCEPTED: 'green',
  REJECTED: 'red',
}

export interface StatusBadgeProps {
  status: DeclarationStatus
  size?: BadgeSize
  className?: string
}

export function StatusBadge({ status, size, className }: StatusBadgeProps) {
  const { t } = useTranslation()

  return (
    <Badge
      variant={STATUS_BADGE_VARIANT[status]}
      size={size}
      dot
      className={className}
    >
      {t(`declarations.status.${status}`)}
    </Badge>
  )
}
