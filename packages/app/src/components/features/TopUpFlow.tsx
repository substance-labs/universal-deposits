import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Modal } from '@/components/ui'
import { AddressInput, TokenSelector } from '@/components/forms'
import { QRCodeDisplay } from './QRCodeDisplay'
import { SourceTokenSelector } from './SourceTokenSelector'
import { useUDSafeAddress, useRegisterAddress } from '@/hooks/useAPI'
import { DESTINATION_CHAIN_ID, GNOSIS_TOKENS } from '@/config/constants'
import { isValidAddress } from '@/utils'
import { useERC20Transfer } from '@/utils/erc20Transfer'
import { useWallet } from '@/hooks/useWallet'
import { useTransactionStore } from '@/stores/transactions'
import type { Transaction } from '@/types/transaction'
import {  keccak256, encodePacked } from 'viem'

interface TopUpFlowProps {
  onRedirectToHistory: () => void
}

export const TopUpFlow: React.FC<TopUpFlowProps> = ({ onRedirectToHistory }) => {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [destinationToken, setDestinationToken] = useState<string>(GNOSIS_TOKENS.EURE?.address || '')
  const [showDeposit, setShowDeposit] = useState(false)
  const [showDepositDropdown, setShowDepositDropdown] = useState(false)
  const [sourceTokenData, setSourceTokenData] = useState<{
    chainId: number
    chainName: string
    tokenSymbol: string
    tokenAddress: string
    amount: string
    decimals: number
    isValid: boolean
  } | null>(null)
  const [showTransactionModal, setShowTransactionModal] = useState(false)

  const { address: walletAddress } = useWallet()
  const { transfer, isTransferring, transferError, transferHash, resetState } = useERC20Transfer()
  const { addTransaction } = useTransactionStore()
  const registerMutation = useRegisterAddress()

  console.log('🚀 TopUpFlow render:', {
    recipientAddress,
    destinationToken,
    showDeposit,
    isValidAddress: recipientAddress ? isValidAddress(recipientAddress) : false
  })

  const udSafeParams = recipientAddress && isValidAddress(recipientAddress) ? {
    destinationAddress: recipientAddress,
    destinationToken,
    destinationChain: DESTINATION_CHAIN_ID.toString(),
  } : null

  console.log('🔧 udSafeParams:', udSafeParams)
  console.log('🔧 udSafeParams validation:', {
    hasDestinationAddress: !!udSafeParams?.destinationAddress,
    hasDestinationToken: !!udSafeParams?.destinationToken, 
    hasDestinationChain: !!udSafeParams?.destinationChain,
    enabled: !!(udSafeParams?.destinationAddress && udSafeParams?.destinationToken && udSafeParams?.destinationChain)
  })

  const { data: udSafeData, isLoading: isLoadingUDSafe, error: udSafeError } = useUDSafeAddress(udSafeParams)
  console.log('📊 Hook results:', {
    udSafeData,
    isLoadingUDSafe,
    udSafeError,
    // orderData,
    // orderError,
    registerMutationState: {
      isPending: registerMutation.isPending,
      isError: registerMutation.isError,
      error: registerMutation.error
    }
  })

  useEffect(() => {
    console.log('🔄 useEffect triggered:', { udSafeData, recipientAddress })
    if (udSafeData?.data?.udSafeAddress && recipientAddress) {
      console.log('✅ Setting showDeposit to true')
      setShowDeposit(true)
    } else {
      console.log('❌ Setting showDeposit to false')
      setShowDeposit(false)
    }
  }, [udSafeData, recipientAddress])



  const handleAddressChange = (newAddress: string) => {
    console.log('📝 Address changed:', { old: recipientAddress, new: newAddress })
    setRecipientAddress(newAddress)
  }

  const handleConfirmTransfer = async () => {
    if (!sourceTokenData || !udSafeData?.data?.udSafeAddress || !walletAddress) {
      console.error('❌ Missing data for transfer')
      return
    }

    console.log("Confirm transaction called")
    try {
      resetState()
      console.log('🚀 Starting ERC20 transfer:', {
        tokenAddress: sourceTokenData.tokenAddress,
        toAddress: udSafeData?.data?.udSafeAddress,
        amount: sourceTokenData.amount,
        decimals: sourceTokenData.decimals,
        chainId: sourceTokenData.chainId
      })

      const hash = await transfer({
        tokenAddress: sourceTokenData.tokenAddress as `0x${string}`,
        toAddress: udSafeData?.data?.udSafeAddress as `0x${string}`,
        amount: sourceTokenData.amount,
        decimals: sourceTokenData.decimals,
        chainId: sourceTokenData.chainId
      })

      console.log('✅ Transfer successful:', hash)
      
      // Create transaction record



        // Create order ID using keccak256
        const transactionId = keccak256(
          encodePacked(
            ['uint256', 'uint256', 'address', 'address', 'address', 'address'],
            [
              BigInt( sourceTokenData.chainId), // sourceChainId, selected by the source chain
              BigInt(DESTINATION_CHAIN_ID), // destinationChainId, 100 for Gnosis Chain
              recipientAddress as `0x${string}`, // recipientAddress, which is the 
              udSafeData?.data?.udSafeAddress, // udAddress
              sourceTokenData.tokenAddress as `0x${string}`, // sourceToken
              destinationToken as `0x${string}`, // destinationToken
            ],
          ),
        )
    //  const transactionId = `${hash}-${Date.now()}`
      const transaction: Transaction = {
        id: transactionId,
        txHash: hash,
        destinationAddress: recipientAddress,
        destinationChain: DESTINATION_CHAIN_ID.toString(),
        destinationToken: destinationToken,
        sourceChain: sourceTokenData.chainId.toString(),
        sourceToken: sourceTokenData.tokenAddress,
        amount: sourceTokenData.amount,
        status: 'Deposited',
        createdAt: Date.now(),
        details: {
          sourceChainName: sourceTokenData.chainName,
          sourceTokenSymbol: sourceTokenData.tokenSymbol,
          destinationTokenSymbol: destinationToken === GNOSIS_TOKENS.EURE.address as `0x${string}` ? 'EURE' : 'USDC',
          toAddress: udSafeData?.data?.udSafeAddress
        }
      }
      
      addTransaction(transaction)
      
      // // Register address with API
      try {
              
    
        console.log('🔄 Registering address...')
        const registerResult = await registerMutation.mutateAsync({
          destinationAddress: recipientAddress,
          destinationToken: destinationToken,
          destinationChain: DESTINATION_CHAIN_ID.toString()
        })
        
        if (registerResult.success) {
          console.log('✅ Address registered successfully')
          
          // Close modal and redirect to history
          setShowTransactionModal(false)

      //       // Create transaction record
      // const transactionId = [...Array(32)].map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')
      // const transaction: Transaction = {
      //   id: transactionId,
      //   txHash: [...Array(32)].map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''),
      //   destinationAddress: recipientAddress,
      //   destinationChain: DESTINATION_CHAIN_ID.toString(),
      //   destinationToken: destinationToken,
      //   sourceChain: sourceTokenData.chainId.toString(),
      //   sourceToken: sourceTokenData.tokenAddress,
      //   amount: sourceTokenData.amount,
      //   status: 'Deposited',
      //   createdAt: Date.now(),
      //   details: {
      //     sourceChainName: sourceTokenData.chainName,
      //     sourceTokenSymbol: sourceTokenData.tokenSymbol,
      //     destinationTokenSymbol: destinationToken === GNOSIS_TOKENS.EURE ? 'EURE' : 'USDC',
      //     toAddress: udSafeData?.data?.udSafeAddress
      //   }
      // }
      
      // addTransaction(transaction)


          onRedirectToHistory()
        } else {
          console.error('❌ Failed to register address:', registerResult.error)
        }
      } catch (registerError) {
        console.error('❌ Registration failed:', registerError)
      }
      
    } catch (error) {
      console.error('❌ Transfer failed:', error)
    }
  }

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>TopUp your account on Gnosis Chain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Top up your Gnosis Pay card from any supported chain 
            /
            Withdraw from CEX with the supported chains and tokens
          </p>
          
          <TokenSelector
            value={destinationToken}
            onChange={setDestinationToken}
            label="Receiving Token on GC"
          />
          
          <AddressInput
            value={recipientAddress}
            onChange={handleAddressChange}
            label="Gnosis Chain Address"
            placeholder="Enter your Gnosis Chain address"
          />
          
          {recipientAddress && (
            <SourceTokenSelector 
              onValidationChange={setSourceTokenData}
              udAddress={udSafeData?.data?.udSafeAddress}
            />
          )}
          
          {(() => {
            const isLoading = registerMutation.isPending || isLoadingUDSafe
            console.log('🔘 Button visibility check:', {
              recipientAddress: !!recipientAddress,
              isValidAddress: recipientAddress ? isValidAddress(recipientAddress) : false,
              showDeposit,
             
              isLoading,
              registerMutationPending: registerMutation.isPending,
              isLoadingUDSafe
            })
            
            const shouldShowReviewButton = sourceTokenData?.isValid && recipientAddress && isValidAddress(recipientAddress)
            
            return  shouldShowReviewButton ? (
              <Button
                onClick={() => setShowTransactionModal(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Review Transaction
              </Button>
            ) : null
          })()}
        </CardContent>
      </Card>

      {showDeposit && udSafeData?.data?.udSafeAddress && (
        <Card>
          <CardContent>
            <Button
              onClick={() => setShowDepositDropdown(!showDepositDropdown)}
              className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-between"
            >
              <span>Get my deposit address</span>
              <span className={`transform transition-transform ${showDepositDropdown ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </Button>
            
            {showDepositDropdown && (
              <div className="space-y-4">
                <QRCodeDisplay address={udSafeData?.data?.udSafeAddress} />
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">
                    How to complete your top-up:
                  </h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Copy the deposit address above</li>
                    <li>Send supported tokens from any chain to this address</li>
                    <li>Wait for the cross-chain transfer to complete</li>
                    <li>Tokens will arrive in your Gnosis Chain account</li>
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
     

      <Modal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        title="Transaction Details"
      >
        {sourceTokenData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-600">Source Chain</p>
                <p>{sourceTokenData.chainName}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Source Token</p>
                <p>{sourceTokenData.tokenSymbol}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Amount</p>
                <p>{sourceTokenData.amount} {sourceTokenData.tokenSymbol}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">To Address</p>
                <p className="break-all">{udSafeData?.data?.udSafeAddress || 'Loading...'}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Destination Chain</p>
                <p>Gnosis Chain</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Destination Address</p>
                <p className="break-all">{recipientAddress}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Receive Token</p>
                <p>{destinationToken === GNOSIS_TOKENS.EURE.address ? 'EURE' : 'USDC'}</p>
              </div>
            </div>
            
            {transferError && (
              <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Transfer Error:</strong> {transferError}
                </p>
              </div>
            )}
            
            {transferHash && (
              <div className="p-3 border border-green-200 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Transfer Successful!</strong>
                </p>
                <p className="text-xs text-green-700 mt-1 break-all">
                  Transaction Hash: {transferHash}
                </p>
              </div>
            )}
            
            <div className="pt-4 border-t space-y-3">
              <Button
                onClick={handleConfirmTransfer}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={isTransferring || !walletAddress}
              >
                {isTransferring ? 'Confirming Transfer...' : 'Confirm Transfer'}
              </Button>
              
              <Button
                onClick={() => setShowTransactionModal(false)}
                className="w-full"
                variant="secondary"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}