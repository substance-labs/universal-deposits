import { parseUnits } from 'viem'
import { useWalletClient, usePublicClient, useSwitchChain } from 'wagmi'
import { useState, useCallback } from 'react'

// ERC20 ABI for transfer function - no outputs to handle non-standard tokens
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  }
] as const

interface TransferParams {
  tokenAddress: `0x${string}`
  toAddress: `0x${string}`
  amount: string
  decimals: number
  chainId: number
}

export const useERC20Transfer = () => {
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferHash, setTransferHash] = useState<string | null>(null)
  
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { switchChain } = useSwitchChain()

  const transfer = useCallback(async ({
    tokenAddress,
    toAddress,
    amount,
    decimals,
    chainId
  }: TransferParams): Promise<string> => {
    if (!walletClient || !publicClient) {
      throw new Error('Wallet not connected')
    }

    if (walletClient.chain?.id !== chainId) {
      console.log(`🔄 Switching to chain ${chainId}...`)
      try {
        await switchChain({ chainId })
        // Give a small delay for the chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (switchError: any) {
        throw new Error(`Failed to switch to chain ${chainId}: ${switchError.message}`)
      }
    }

    setIsTransferring(true)
    setTransferError(null)
    setTransferHash(null)

    try {
      // Parse amount to wei/token units
      const parsedAmount = parseUnits(amount, decimals)

      // Simulate the transaction first
      console.log('🔄 Simulating ERC20 transfer:', {
        tokenAddress,
        toAddress,
        amount: parsedAmount.toString(),
        from: walletClient.account.address
      })

      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [toAddress, parsedAmount],
        account: walletClient.account.address,
      })

      console.log('✅ Simulation successful, executing transfer...')

      // Execute the transaction
      const hash = await walletClient.writeContract(request)
      
      console.log('📝 Transaction submitted:', hash)
      setTransferHash(hash)

      // Wait for transaction confirmation
      console.log('⏳ Waiting for confirmation...')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      console.log('✅ Transaction confirmed:', receipt)
      
      return hash
    } catch (error: any) {
      console.error('❌ Transfer failed:', error)
      const errorMessage = error.shortMessage || error.message || 'Transfer failed'
      setTransferError(errorMessage)
      throw error
    } finally {
      setIsTransferring(false)
    }
  }, [walletClient, publicClient, switchChain])

  const resetState = useCallback(() => {
    setTransferError(null)
    setTransferHash(null)
  }, [])

  return {
    transfer,
    isTransferring,
    transferError,
    transferHash,
    resetState
  }
}