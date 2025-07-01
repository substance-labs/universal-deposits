import { http, createConfig } from 'wagmi'
import { mainnet, optimism, polygon, arbitrum, base, bsc, gnosis, celo, unichain, worldchain } from 'wagmi/chains'
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors'

const projectId = (import.meta as any).env.VITE_WALLETCONNECT_PROJECT_ID

export const config = createConfig({
  chains: [mainnet, optimism, polygon, arbitrum, base, bsc, gnosis, celo, unichain, worldchain],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: 'Universal Deposits' }),
    // Only include WalletConnect if project ID is available
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [bsc.id]: http(),
    [gnosis.id]: http(),
    [celo.id]: http(),
    [unichain.id]: http(),
    [worldchain.id]: http()
  },
})