import React from 'react'
import { cn } from '@/utils'

interface NavbarProps {
  activeTab: 'topup' | 'history' | 'chains'
  onTabChange: (tab: 'topup' | 'history' | 'chains') => void
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="flex space-x-8">
        <button
          onClick={() => onTabChange('topup')}
          className={cn(
            'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'topup'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          TopUp
        </button>
        <button
          onClick={() => onTabChange('history')}
          className={cn(
            'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'history'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          History
        </button>
        <button
          onClick={() => onTabChange('chains')}
          className={cn(
            'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'chains'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          Supported Chains & Tokens
        </button>
      </div>
    </nav>
  )
}