import React, { useState, useMemo } from 'react'
import { BigNumber } from 'ethers'
import { Card, Select, Input } from '@/components/ui'
import { useUserTokenBalancesAllChains, getTokenMetadata } from '@/hooks/useUserTokenListBalances'
import { useWallet } from '@/hooks/useWallet'
import { formatUnits } from 'ethers/lib/utils'

import { chains } from '@universal-deposits/constants'

interface ChainBalance {
  chainId: number
  chainName: string
  tokenAddress: string
  tokenSymbol: string
  balance: BigNumber
  decimals: number
}

interface SourceTokenSelectorProps {
  onValidationChange?: (data: {
    chainId: number
    chainName: string
    tokenSymbol: string
    tokenAddress: string
    amount: string
    decimals: number
    isValid: boolean
  } | null) => void
  udAddress?: string
}

export const SourceTokenSelector: React.FC<SourceTokenSelectorProps> = ({ onValidationChange }) => {
  const { address } = useWallet()
  const { data: balancesByChain, isLoading } = useUserTokenBalancesAllChains({ userAddress: address || null })
  
  console.log('🎯 SourceTokenSelector - Debug info:', {
    address,
    balancesByChain,
    isLoading,
    hasBalances: balancesByChain && Object.keys(balancesByChain).length > 0
  })
  
  const [selectedOption, setSelectedOption] = useState<string>('')

  const [amount, setAmount] = useState<string>('')
  const [validationError, setValidationError] = useState<string>('')

  // Convert balances to chain options with token info
  const chainOptions = useMemo(() => {
    console.log('🔄 Processing chainOptions, balancesByChain:', balancesByChain)
    if (!balancesByChain) {
      console.log('❌ No balancesByChain data')
      return []
    }
    
    const options: ChainBalance[] = []
    
    Object.entries(balancesByChain).forEach(([chainIdStr, balances]) => {
      const chainId = parseInt(chainIdStr)
      console.log(`⛓️ Processing chain ${chainId} with balances:`, balances)
      const chain = chains.find((c) => c.chainId === chainId)
      if (!chain) {
        console.log(`❌ Chain ${chainId} not found in chains config`)
        return
      }
      
      Object.entries(balances).forEach(([tokenAddress, balance]) => {
        console.log(`🪙 Processing token ${tokenAddress} with balance:`, balance.toString())
        const tokenMeta = getTokenMetadata(chainId, tokenAddress)
        console.log(`📋 Token metadata for ${tokenAddress}:`, tokenMeta)
        if (!tokenMeta) {
          console.log(`❌ No metadata found for token ${tokenAddress} on chain ${chainId}`)
          return
        }
        
        // Get decimals from token metadata
        const decimals = tokenMeta.decimals || 18
        
        const option = {
          chainId,
          chainName: chain.name,
          tokenAddress,
          tokenSymbol: tokenMeta.symbol,
          balance,
          decimals
        }
        console.log('✅ Adding option:', option)
        options.push(option)
      })
    })
    
    console.log('📊 Final chainOptions:', options)
    return options.sort((a, b) => a.chainName.localeCompare(b.chainName))
  }, [balancesByChain])

  const selectedChainBalance = useMemo(() => {
    if (!selectedOption) return null
    const [chainId, tokenAddress] = selectedOption.split('-')
    return chainOptions.find(option => 
      option.chainId === parseInt(chainId) && option.tokenAddress === tokenAddress
    )
  }, [chainOptions, selectedOption])

  const validateAmount = (value: string) => {
    if (!value || !selectedChainBalance) {
      setValidationError('')
      onValidationChange?.(null)
      return
    }

    try {
      const inputAmount = parseFloat(value)
      if (isNaN(inputAmount) || inputAmount <= 0) {
        setValidationError('Please enter a valid amount')
        onValidationChange?.(null)
        return
      }

      const balanceFormatted = parseFloat(formatUnits(selectedChainBalance.balance, selectedChainBalance.decimals))
      
      if (inputAmount > balanceFormatted) {
        setValidationError(`Amount exceeds balance (${balanceFormatted.toFixed(6)} ${selectedChainBalance.tokenSymbol})`)
        onValidationChange?.(null)
        return
      }

      setValidationError('')
      onValidationChange?.({
        chainId: selectedChainBalance.chainId,
        chainName: selectedChainBalance.chainName,
        tokenSymbol: selectedChainBalance.tokenSymbol,
        tokenAddress: selectedChainBalance.tokenAddress,
        amount: value,
        decimals: selectedChainBalance.decimals,
        isValid: true
      })
    } catch (error) {
      setValidationError('Invalid amount format')
      onValidationChange?.(null)
    }
  }

  const handleAmountChange = (value: string) => {
    setAmount(value)
    validateAmount(value)
  }

  const handleChainSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedOption(value)
    setAmount('')
    setValidationError('')
    onValidationChange?.(null)
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">
          Loading token balances...
        </div>
      </Card>
    )
  }

  if (chainOptions.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">
          No token balances found. Please ensure you have supported tokens with positive balances.
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Select Source Token</h3>
      
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chain & Token
          </label>
          <Select
            value={selectedOption}
            onChange={handleChainSelect}
          >
            <option value="" disabled>Select chain with token balance</option>
            {chainOptions.map((option) => (
              <option key={`${option.chainId}-${option.tokenAddress}`} value={`${option.chainId}-${option.tokenAddress}`}>
                {option.chainName} - {option.tokenSymbol} ({formatUnits(option.balance, option.decimals).slice(0, 8)})
              </option>
            ))}
          </Select>
          
          {selectedChainBalance && (
            <div className="mt-2 text-sm text-gray-600">
              Balance: {formatUnits(selectedChainBalance.balance, selectedChainBalance.decimals)} {selectedChainBalance.tokenSymbol}
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount
          </label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="Enter amount"
            disabled={!selectedOption}
            className={validationError ? 'border-red-500' : ''}
          />
          
          {validationError && (
            <div className="mt-1 text-sm text-red-600">
              {validationError}
            </div>
          )}
          
          {selectedChainBalance && amount && !validationError && (
            <div className="mt-1 text-sm text-green-600">
              ✓ Valid amount
            </div>
          )}
        </div>
      </div>
      
    </Card>
  )
}