import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Transaction } from '@/types/transaction'

interface TransactionStore {
  transactions: Transaction[]
  addTransaction: (transaction: Transaction) => void
  updateTransactionStatus: (id: string, status: Transaction['status'], statusMessage?: string) => void
  getTransaction: (id: string) => Transaction | undefined
  clearTransactions: () => void
}

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set, get) => ({
      transactions: [],
      
      addTransaction: (transaction) => {
        set((state) => ({
          transactions: [transaction, ...state.transactions]
        }))
      },
      
      updateTransactionStatus: (id, status, statusMessage) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id 
              ? { ...tx, status, statusMessage }
              : tx
          )
        }))
      },
      
      getTransaction: (id) => {
        return get().transactions.find((tx) => tx.id === id)
      },
      
      clearTransactions: () => {
        set({ transactions: [] })
      }
    }),
    {
      name: 'universal-deposits-transactions'
    }
  )
)