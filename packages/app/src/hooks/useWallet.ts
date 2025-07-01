import { useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useWalletStore } from '@/stores/wallet'

export const useWallet = () => {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  
  const {
    setAddress,
    setConnected,
    setConnecting,
    setChainId,
    reset,
    balances,
    isLoadingBalances,
  } = useWalletStore()

  useEffect(() => {
    if (address) {
      setAddress(address)
    } else {
      reset()
    }
  }, [address, setAddress, reset])

  useEffect(() => {
    setConnected(isConnected)
  }, [isConnected, setConnected])

  useEffect(() => {
    setConnecting(isPending)
  }, [isPending, setConnecting])

  useEffect(() => {
    if (chainId) {
      setChainId(chainId)
    }
  }, [chainId, setChainId])

  const handleConnect = (connectorId?: string) => {
    const connector = connectorId 
      ? connectors.find(c => c.id === connectorId)
      : connectors[0]
    
    if (connector) {
      connect({ connector })
    }
  }

  const handleDisconnect = () => {
    disconnect()
    reset()
  }

  return {
    address,
    isConnected,
    chainId,
    balances,
    isLoadingBalances,
    isConnecting: isPending,
    connectors,
    connect: handleConnect,
    disconnect: handleDisconnect,
  }
}