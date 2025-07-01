import { create } from 'zustand'
import type { WalletState, DetectedBalance } from '@/types'

interface WalletStore extends WalletState {
  balances: DetectedBalance[]
  isLoadingBalances: boolean
  setAddress: (address: string) => void
  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void
  setChainId: (chainId: number) => void
  setBalances: (balances: DetectedBalance[]) => void
  setLoadingBalances: (loading: boolean) => void
  reset: () => void
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: undefined,
  isConnected: false,
  isConnecting: false,
  chainId: undefined,
  balances: [],
  isLoadingBalances: false,
  
  setAddress: (address) => set({ address }),
  setConnected: (isConnected) => set({ isConnected }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setChainId: (chainId) => set({ chainId }),
  setBalances: (balances) => set({ balances }),
  setLoadingBalances: (isLoadingBalances) => set({ isLoadingBalances }),
  
  reset: () => set({
    address: undefined,
    isConnected: false,
    isConnecting: false,
    chainId: undefined,
    balances: [],
    isLoadingBalances: false,
  }),
}))