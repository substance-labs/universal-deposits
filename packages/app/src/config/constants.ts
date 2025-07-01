import { chains, tokens } from '@universal-deposits/constants'

export const API_BASE_URL =  (import.meta as any).env.API_BASE_URL || '/api'

export const SUPPORTED_CHAINS = chains.reduce((acc, chain) => {
  const key = chain.name.toLowerCase().replace(/\s+/g, '')
  acc[key] = { id: chain.chainId, name: chain.name }
  return acc
}, {} as Record<string, { id: number; name: string }>)

export const DESTINATION_CHAIN_ID = 100 // Gnosis Chain

export const GNOSIS_TOKENS = tokens[100] || {}

export const ORDER_STATUS_LABELS = {
  Registered: 'Waiting for Deposit',
  Deploying: 'Deploying Contracts',
  Deployed: 'Contracts Deployed',
  Settling: 'Processing Settlement',
  Settled: 'Settlement Complete',
  Verifying: 'Verifying Transfer',
  Completed: 'Transfer Complete',
  DeploymentFailed: 'Deployment Failed',
  SettlementFailed: 'Settlement Failed',
  VerificationFailed: 'Verification Failed',
  VerificationTimeout: 'Verification Timeout',
} as const

export const ORDER_STATUS_COLORS = {
  Registered: 'warning',
  Deploying: 'primary',
  Deployed: 'primary',
  Settling: 'primary',
  Settled: 'primary',
  Verifying: 'primary',
  Completed: 'success',
  DeploymentFailed: 'error',
  SettlementFailed: 'error',
  VerificationFailed: 'error',
  VerificationTimeout: 'error',
} as const