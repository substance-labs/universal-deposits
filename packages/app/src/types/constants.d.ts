declare module '@universal-deposits/constants' {
  export const allowListToken: Record<string, Record<string, string>>
  export const gnosisChainToken: Record<string, Record<string, string>>
  export const chains: Array<{
    chainId: number
    name: string
    rpcUrl: string
    blockExplorer: string
    isTestnet?: boolean
  }>
  export const tokens: Record<number, Record<string, {
    symbol: string
    name: string
    address: string
    decimals: number
    logoURI: string
  }>>
  export const addresses: Record<string, string>
  export const ADDRESSES: Record<string, string>
}