import React, { useState } from 'react'
import { Button } from '@/components/ui'
import { useWallet } from '@/hooks/useWallet'
import { formatAddress } from '@/utils'

export const ConnectButton: React.FC = () => {
  const { address, isConnected, isConnecting, connect, disconnect, connectors } = useWallet()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  if (isConnected && address) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2"
        >
          <span>{formatAddress(address)}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
        
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              <button
                onClick={() => {
                  disconnect()
                  setIsDropdownOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        isLoading={isConnecting}
        disabled={isConnecting}
        className="flex items-center space-x-2"
      >
        <span>Connect Wallet</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>
      
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="py-1">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => {
                  connect(connector.id)
                  setIsDropdownOpen(false)
                }}
                disabled={isConnecting}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect {connector.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}