import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createTransactionSchema } from 'nalogai-shared/validators/transaction.validators'
import type { TransactionCategory, TransactionType } from 'nalogai-shared/types/transaction.types'
import type { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { Select } from '@components/ui/Select'
import { toast } from '@store/notificationStore'
import { useTransactionStore } from '@store/transactionStore'
import { apiCreateTransaction } from '@api/transactions'
import { getCategoryLabel } from './CategoryBadge'

type FormData = z.infer<typeof createTransactionSchema>

const INCOME_CATEGORIES: TransactionCategory[] = [
  'SERVICES_INCOME', 'GOODS_INCOME', 'RENT_INCOME', 'CONSULTING_INCOME',
  'FREELANCE_INCOME', 'DIVIDEND_INCOME', 'INTEREST_INCOME', 'ASSET_SALE_INCOME', 'OTHER_INCOME',
]
const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'OFFICE_EXPENSES', 'EQUIPMENT_EXPENSES', 'MARKETING_EXPENSES', 'SALARY_EXPENSES',
  'TRANSPORT_EXPENSES', 'UTILITIES_EXPENSES', 'INSURANCE_EXPENSES', 'TAX_EXPENSES',
  'BANK_EXPENSES', 'REPAIR_EXPENSES', 'SUBSCRIPTION_EXPENSES', 'OTHER_EXPENSES',
]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddTransactionModal({ open, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { addTransaction } = useTransactionStore()
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      type: 'INCOME',
      category: 'SERVICES_INCOME',
      source: 'MANUAL',
      date: new Date().toISOString().slice(0, 10),
    },
  })

  const selectedType = watch('type') as TransactionType
  const typeOptions = [
    { value: 'INCOME', label: t('transactions.type.income') },
    { value: 'EXPENSE', label: t('transactions.type.expense') },
  ]
  const categoryOptions = (
    selectedType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  ).map((c) => ({ value: c, label: getCategoryLabel(c, t) }))

  async function onSubmit(data: FormData) {
    const tx = await apiCreateTransaction(data)
    addTransaction(tx)
    toast.success(t('transactions.form.added'))
    reset()
    onClose()
    onSuccess()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('transactions.form.title')}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2" noValidate>
        {/* Type */}
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select
              label={t('transactions.form.type')}
              value={field.value}
              onChange={field.onChange}
              options={typeOptions}
            />
          )}
        />

        {/* Amount */}
        <Input
          type="number"
          label={t('transactions.form.amount')}
          placeholder="0"
          suffix="₸"
          error={errors.amount?.message}
          {...register('amount', { valueAsNumber: true })}
        />

        {/* Category */}
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select
              label={t('transactions.form.category')}
              value={field.value}
              onChange={field.onChange}
              options={categoryOptions}
              error={errors.category?.message}
            />
          )}
        />

        {/* Description */}
        <Input
          label={t('transactions.form.description')}
          placeholder={t('transactions.form.descriptionPlaceholder')}
          error={errors.description?.message}
          {...register('description')}
        />

        {/* Date */}
        <Input
          type="text"
          label={t('transactions.form.date')}
          placeholder="2025-04-15"
          error={errors.date?.message}
          hint={t('transactions.form.dateHint')}
          {...register('date')}
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" size="md" className="flex-1" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" size="md" className="flex-1" loading={isSubmitting}>
            {t('common.actions.add')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
