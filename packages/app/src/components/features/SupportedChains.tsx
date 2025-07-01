import React from 'react'
import { chains, tokens } from '@universal-deposits/constants'

interface TokenData {
  [key: string]: string
}

interface ChainTokens {
  [chainName: string]: TokenData
}

// Generate chain tokens from the constants
const CHAIN_TOKENS: ChainTokens = {}
chains.forEach(chain => {
  const chainTokens = tokens[chain.chainId]
  if (chainTokens) {
    const chainKey = `${chain.name} (${chain.chainId})`
    CHAIN_TOKENS[chainKey] = {}
    Object.entries(chainTokens).forEach(([symbol, tokenInfo]) => {
      CHAIN_TOKENS[chainKey][symbol] = tokenInfo.address
    })
  }
})

export const SupportedChains: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Supported Chains & Tokens</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chain Name (Chain ID)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Supported Tokens
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(CHAIN_TOKENS).map(([chainName, tokens]) => (
              <tr key={chainName} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {chainName}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    {Object.entries(tokens).map(([tokenName, tokenAddress]) => (
                      <div key={tokenName} className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-medium text-gray-700 mb-1 sm:mb-0">
                          {tokenName}:
                        </span>
                        <code className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded font-mono break-all">
                          {tokenAddress}
                        </code>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 text-sm text-gray-500">
        <p>
          <strong>Note:</strong> These are the currently supported chains and their respective token contracts. 
          All deposits are bridged to Gnosis Chain (Chain ID: 100).
        </p>
      </div>
    </div>
  )
}