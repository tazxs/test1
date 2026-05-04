import { create } from 'zustand'
import type { Transaction, TransactionCategory } from 'nalogai-shared/types/transaction.types'

interface TransactionStore {
  transactions: Transaction[]
  isLoaded: boolean
  userId: string | null

  setTransactions: (txs: Transaction[], userId: string) => void
  addTransaction: (tx: Transaction) => void
  addBulk: (txs: Transaction[]) => void
  updateCategory: (id: string, category: TransactionCategory) => void
  reset: () => void
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  transactions: [],
  isLoaded: false,
  userId: null,

  setTransactions: (transactions, userId) =>
    set({ transactions, isLoaded: true, userId }),

  addTransaction: (tx) =>
    set((s) => ({ transactions: [tx, ...s.transactions] })),

  // Deduplicate by externalId when it exists, or by date+description+amount
  addBulk: (incoming) =>
    set((s) => {
      const existing = s.transactions
      const newOnes = incoming.filter((inc) => {
        if (inc.externalId) {
          return !existing.some((e) => e.externalId === inc.externalId)
        }
        return !existing.some(
          (e) => e.date === inc.date && e.amount === inc.amount && e.description === inc.description,
        )
      })
      return { transactions: [...newOnes, ...existing] }
    }),

  updateCategory: (id, category) =>
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === id ? { ...t, category, updatedAt: new Date().toISOString() } : t,
      ),
    })),

  reset: () => set({ transactions: [], isLoaded: false, userId: null }),
}))
