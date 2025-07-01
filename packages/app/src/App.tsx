import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/config/wagmi'
import { ConnectButton } from '@/components/wallet'
import { TopUpFlow, History, SupportedChains } from '@/components/features'
import { Navbar } from '@/components/ui'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
})

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'topup' | 'history' | 'chains'>('topup')

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-start mb-8">
              <div className="flex-1 text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Universal Deposits
                </h1>
                <p className="text-gray-600">
                  Transfer assets seamlessly across chains to Gnosis Chain
                </p>
              </div>
              
              <div className="flex-shrink-0">
                <ConnectButton />
              </div>
            </div>

            <div className="max-w-2xl mx-auto mb-8">
              <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            <main className="max-w-2xl mx-auto">
              {activeTab === 'topup' ? (
                <TopUpFlow onRedirectToHistory={() => setActiveTab('history')} />
              ) : activeTab === 'history' ? (
                <History />
              ) : (
                <SupportedChains />
              )}
            </main>

            <footer className="text-center mt-16 text-sm text-gray-500">
              <p>
                Powered by Universal Deposits Protocol
              </p>
            </footer>
          </div>
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  )
}