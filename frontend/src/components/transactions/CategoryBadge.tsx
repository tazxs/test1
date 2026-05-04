import type { TransactionCategory } from 'nalogai-shared/types/transaction.types'
import { useTranslation } from 'react-i18next'
import { cn } from '@utils/cn'

interface CategoryStyle {
  bg: string
  color: string
  dashed?: boolean
}

const CATEGORY_STYLES: Record<TransactionCategory, CategoryStyle> = {
  SERVICES_INCOME:       { bg: 'rgba(0,232,122,0.1)',    color: '#00E87A' },
  GOODS_INCOME:          { bg: 'rgba(0,178,255,0.1)',    color: '#00B2FF' },
  RENT_INCOME:           { bg: 'rgba(165,120,255,0.1)',  color: '#A578FF' },
  CONSULTING_INCOME:     { bg: 'rgba(0,232,122,0.08)',   color: '#00E87A' },
  FREELANCE_INCOME:      { bg: 'rgba(0,200,200,0.1)',    color: '#00C8C8' },
  DIVIDEND_INCOME:       { bg: 'rgba(255,184,0,0.1)',    color: '#FFB800' },
  INTEREST_INCOME:       { bg: 'rgba(0,178,255,0.08)',   color: '#00B2FF' },
  ASSET_SALE_INCOME:     { bg: 'rgba(165,120,255,0.08)', color: '#A578FF' },
  OTHER_INCOME:          { bg: 'rgba(0,232,122,0.06)',   color: '#00E87A' },
  OFFICE_EXPENSES:       { bg: 'rgba(255,184,0,0.1)',    color: '#FFB800' },
  EQUIPMENT_EXPENSES:    { bg: 'rgba(0,200,200,0.1)',    color: '#00C8C8' },
  MARKETING_EXPENSES:    { bg: 'rgba(255,120,80,0.1)',   color: '#FF7850' },
  SALARY_EXPENSES:       { bg: 'rgba(165,120,255,0.1)',  color: '#A578FF' },
  TRANSPORT_EXPENSES:    { bg: 'rgba(255,160,200,0.1)',  color: '#FFA0C8' },
  UTILITIES_EXPENSES:    { bg: 'rgba(255,184,0,0.1)',    color: '#FFB800' },
  INSURANCE_EXPENSES:    { bg: 'rgba(0,178,255,0.08)',   color: '#00B2FF' },
  TAX_EXPENSES:          { bg: 'rgba(255,77,77,0.1)',    color: '#FF4D4D' },
  BANK_EXPENSES:         { bg: 'rgba(0,200,200,0.08)',   color: '#00C8C8' },
  REPAIR_EXPENSES:       { bg: 'rgba(255,120,80,0.08)',  color: '#FF7850' },
  SUBSCRIPTION_EXPENSES: { bg: 'rgba(165,120,255,0.08)', color: '#A578FF' },
  OTHER_EXPENSES:        { bg: 'rgba(240,244,255,0.08)', color: 'rgba(240,244,255,0.6)' },
  UNCATEGORIZED:         { bg: 'rgba(255,77,77,0.08)',   color: '#FF4D4D', dashed: true },
}

export function getCategoryLabel(
  category: TransactionCategory,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  return t(`transactions.category.${category}`)
}

interface Props {
  category: TransactionCategory
  size?: 'sm' | 'md'
}

export function CategoryBadge({ category, size = 'md' }: Props) {
  const { t } = useTranslation()
  const style = CATEGORY_STYLES[category]

  return (
    <span
      className={cn(
        'inline-flex items-center font-body font-medium rounded-md whitespace-nowrap',
        style.dashed ? 'border border-dashed' : '',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1',
      )}
      style={{
        background: style.bg,
        color: style.color,
        borderColor: style.dashed ? style.color : undefined,
      }}
    >
      {getCategoryLabel(category, t)}
    </span>
  )
}
