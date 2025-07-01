import React, { useState, useCallback } from 'react'
import { Input } from '@/components/ui'
import { isValidAddress, checksumAddress } from '@/utils'

interface AddressInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
}

export const AddressInput: React.FC<AddressInputProps> = ({
  value,
  onChange,
  label = 'Address',
  placeholder = 'Enter wallet address (0x...)',
  error,
  disabled,
}) => {
  const [inputError, setInputError] = useState<string>()

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.trim()
    
    // Clear previous errors
    setInputError(undefined)
    
    // Update value
    onChange(inputValue)
    
    // Validate if value is not empty
    if (inputValue && !isValidAddress(inputValue)) {
      setInputError('Invalid Ethereum address')
    }
  }, [onChange])

  const handleBlur = useCallback(() => {
    if (value && isValidAddress(value)) {
      // Apply checksum formatting
      const checksummed = checksumAddress(value)
      if (checksummed !== value) {
        onChange(checksummed)
      }
    }
  }, [value, onChange])

  return (
    <Input
      label={label}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      error={error || inputError}
      disabled={disabled}
    />
  )
}