import { useQuery } from '@tanstack/react-query'
import { allowListToken, gnosisChainToken, tokens } from '@universal-deposits/constants'

const ALCHEMY_API_KEY = (import.meta as any).env.VITE_ALCHEMY_API_KEY || ''

const apiUrl: Record<string, string> = {
  '1': `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  '10': `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
   '56': `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, 
  '100': `https://gnosis-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, 
  '137': `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  '8453': `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  '42161': `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  '42220': `https://celo-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
}


const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

// Helper function to get token metadata from constants
export const getTokenMetadata = (chainId: number, tokenAddress: string) => {
  // First try the new tokens structure
  const chainTokens = tokens[chainId] || {}
  const normalizedAddress = tokenAddress.toLowerCase()
  
  // Search in new tokens structure
  for (const [symbol, tokenInfo] of Object.entries(chainTokens)) {
    if (tokenInfo.address.toLowerCase() === normalizedAddress) {
      return {
        symbol: symbol.toUpperCase(),
        address: tokenInfo.address,
        decimals: tokenInfo.decimals,
        chainId
      }
    }
  }
  
  // Fallback to legacy structures for compatibility
  const legacyChainTokens = allowListToken[String(chainId)] || {}
  const gnosisTokens = gnosisChainToken[String(chainId)] || {}
  
  for (const [symbol, address] of Object.entries({...legacyChainTokens, ...gnosisTokens})) {
    if ((address as string).toLowerCase() === normalizedAddress) {
      return {
        symbol: symbol.toUpperCase(),
        address: address as string,
        decimals: symbol.toLowerCase() === 'usdc' || symbol.toLowerCase() === 'usdt' ? 6 : 18,
        chainId
      }
    }
  }
  
  return null
}

// Get allowed token addresses for a specific chain
const getAllowedTokenAddresses = (chainId: number): string[] => {
  const chainStr = String(chainId)
  const allowedTokens = allowListToken[chainStr] || {}
  const gnosisTokens = gnosisChainToken[chainStr] || {}
  
  // Convert all addresses to lowercase for consistent comparison
  return [...Object.values(allowedTokens), ...Object.values(gnosisTokens)].map(addr => (addr as string).toLowerCase())
}

export const useUserTokenListBalances = ({
  chainId,
  userAddress,
}: {
  userAddress: string | null
  chainId: number
}) => {
  return useQuery({
    queryKey: ['tokenUserBalances', userAddress, chainId],
    queryFn: async () => {
    try {
      if (!userAddress || !ALCHEMY_API_KEY) return {} as Record<string, bigint>
      
      // Only proceed if this chain has allowed tokens
      const allowedAddresses = getAllowedTokenAddresses(chainId)
      if (allowedAddresses.length === 0) {
        console.log('No allowed tokens for chain:', chainId)
        return {} as Record<string, bigint>
      }

      const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [userAddress, allowedAddresses], // Only fetch balances for allowed tokens
        id: 1,
      })

      const response = await fetch(apiUrl[String(chainId)], {
        method: 'POST',
        headers,
        body,
      })

      if (!response.ok) {
        throw new Error(`Network error: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        console.error('Alchemy API error:', data.error.message)
        throw new Error(data.error.message)
      }

      const tokenBalances = data.result.tokenBalances
      const balances: Record<string, bigint> = {}

      tokenBalances.forEach((token: { contractAddress: string; tokenBalance: string }) => {
        const balance = token.tokenBalance
        // Only include tokens with balance > 0 and in our allowed list
        if (BigInt(balance) > 0n && allowedAddresses.includes(token.contractAddress.toLowerCase())) {
          balances[token.contractAddress.toLowerCase()] = BigInt(balance)
        }
      })

      return balances
    } catch (error) {
      console.log('Error fetching user tokens balances', error)
      console.log('Params with error', {
        chainId,
        userAddress,
      })
      return {} as Record<string, bigint>
    }
    },
    enabled: !!userAddress && !!ALCHEMY_API_KEY,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  })
}

// Hook to get balances for all supported chains
export const useUserTokenBalancesAllChains = ({
  userAddress,
}: {
  userAddress: string | null
}) => {
  const supportedChainIds = Object.keys(allowListToken).concat(Object.keys(gnosisChainToken))
    .map(id => parseInt(id))
    .filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates
  
  console.log('🔍 useUserTokenBalancesAllChains - Debug info:', {
    userAddress,
    supportedChainIds,
    allowListTokenKeys: Object.keys(allowListToken),
    gnosisChainTokenKeys: Object.keys(gnosisChainToken),
    ALCHEMY_API_KEY: ALCHEMY_API_KEY ? '***SET***' : 'NOT_SET'
  })
  
  return useQuery({
    queryKey: ['tokenUserBalancesAllChains', userAddress],
    queryFn: async () => {
      console.log('🚀 Starting balance fetch for all chains')
      const balancesByChain: Record<number, Record<string, bigint>> = {}
      
      // Fetch balances for each supported chain
      await Promise.all(
        supportedChainIds.map(async (chainId) => {
          try {
            console.log(`⛓️ Processing chain ${chainId}`)
            if (!userAddress || !ALCHEMY_API_KEY) {
              console.log(`❌ Skipping chain ${chainId}: userAddress=${!!userAddress}, ALCHEMY_API_KEY=${!!ALCHEMY_API_KEY}`)
              return
            }
            
            // Skip chains that don't have API URLs configured
            if (!apiUrl[String(chainId)]) {
              console.log(`⚠️ No API URL configured for chain ${chainId}`)
              return
            }
            
            const allowedAddresses = getAllowedTokenAddresses(chainId)
            console.log(`📋 Chain ${chainId} allowed addresses:`, allowedAddresses)
            console.log(`📋 Chain ${chainId} allowListToken:`, allowListToken[String(chainId)])
            console.log(`📋 Chain ${chainId} gnosisChainToken:`, gnosisChainToken[String(chainId)])
            if (allowedAddresses.length === 0) {
              console.log(`⚠️ No allowed addresses for chain ${chainId}`)
              return
            }

            const body = JSON.stringify({
              jsonrpc: '2.0',
              method: 'alchemy_getTokenBalances',
              params: [userAddress, allowedAddresses],
              id: 1,
            })

            console.log(`📡 Fetching balances for chain ${chainId} with URL:`, apiUrl[String(chainId)])
            const response = await fetch(apiUrl[String(chainId)], {
              method: 'POST',
              headers,
              body,
            })

            if (!response.ok) {
              console.log(`❌ Network error for chain ${chainId}:`, response.status, response.statusText)
              return
            }

            const data = await response.json()
            console.log(`📊 Raw response for chain ${chainId}:`, data)
            if (data.error) {
              console.log(`❌ API error for chain ${chainId}:`, data.error)
              return
            }

            const tokenBalances = data.result.tokenBalances
            console.log(`🪙 Token balances for chain ${chainId}:`, tokenBalances)
            const chainBalances: Record<string, bigint> = {}

            tokenBalances.forEach((token: { contractAddress: string; tokenBalance: string }) => {
              const balance = BigInt(token.tokenBalance)
              console.log(`💰 Token ${token.contractAddress} balance: ${token.tokenBalance} (isZero: ${balance === 0n}, isAllowed: ${allowedAddresses.includes(token.contractAddress.toLowerCase())})`)
              if (balance > 0n && allowedAddresses.includes(token.contractAddress.toLowerCase())) {
                chainBalances[token.contractAddress.toLowerCase()] = balance
                console.log(`✅ Added token ${token.contractAddress} to balances`)
              }
            })

            console.log(`📈 Final balances for chain ${chainId}:`, Object.keys(chainBalances))
            if (Object.keys(chainBalances).length > 0) {
              balancesByChain[chainId] = chainBalances
            }
          } catch (error) {
            console.log(`❌ Error fetching balances for chain ${chainId}:`, error)
          }
        })
      )
      
      console.log('🏁 Final balancesByChain result:', balancesByChain)
      return balancesByChain
    },
    enabled: !!userAddress && !!ALCHEMY_API_KEY,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  })
}
