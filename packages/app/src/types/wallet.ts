export interface WalletState {
  address?: string
  isConnected: boolean
  isConnecting: boolean
  chainId?: number
}

export interface TokenInfo {
  symbol: string
  name: string
  address: string
  decimals: number
  logoURI?: string
}

export interface ChainInfo {
  id: number
  name: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorers?: {
    name: string
    url: string
  }[]
}

export interface DetectedBalance extends TokenInfo {
  balance: string
  chainId: number
  chainName: string
}