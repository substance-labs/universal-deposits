import React from 'react'
import { Select } from '@/components/ui'
import { tokens } from '@universal-deposits/constants'

interface TokenSelectorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
  chainId?: number
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  value,
  onChange,
  label = 'Token',
  disabled,
  chainId = 100, // Default to Gnosis Chain
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value)
  }

  const chainTokens = tokens[chainId] || {}

  return (
    <Select
      label={label}
      value={value}
      onChange={handleChange}
      disabled={disabled}
    >
      <option value="" disabled>
        Select token
      </option>
      {Object.entries(chainTokens).map(([symbol, tokenInfo]) => (
        <option key={tokenInfo.address} value={tokenInfo.address}>
          {symbol}
        </option>
      ))}
    </Select>
  )
}