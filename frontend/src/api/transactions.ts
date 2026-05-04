import { api } from './axios'
import type { Transaction, CreateTransactionPayload } from 'nalogai-shared/types/transaction.types'

export async function apiFetchTransactions(): Promise<Transaction[]> {
  const allTxs: Transaction[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const { data } = await api.get<{
      success: true
      data:
        | { items: Transaction[]; meta: { page: number; limit: number; total: number; totalPages: number } }
        | Transaction[]
    }>('/transactions', { params: { page, limit: 200 } })

    // Handle both paginated { items, meta } and legacy plain-array formats
    if (Array.isArray(data.data)) {
      allTxs.push(...data.data)
      break // legacy format has no pagination
    }

    allTxs.push(...(data.data.items ?? []))
    totalPages = data.data.meta?.totalPages ?? 0
    page++
  }

  return allTxs
}

export async function apiCreateTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
  const { data } = await api.post<{ success: true; data: Transaction }>('/transactions', payload)
  return data.data
}

export async function apiUpdateTransactionCategory(id: string, category: string): Promise<void> {
  await api.patch(`/transactions/${id}`, { category })
}
