import { isAddress, getAddress } from 'viem'

export const validateAddress = (address: string): boolean => {
  return isAddress(address)
}

export const checksumAddress = (address: string): string => {
  try {
    return getAddress(address)
  } catch {
    return address
  }
}

export const isValidAddress = (address: string): boolean => {
  console.log('🔍 isValidAddress called with:', address)
  if (!address || address.length === 0) {
    console.log('❌ Address is empty or null')
    return false
  }
  const result = isAddress(address)
  console.log('📊 isValidAddress result:', result)
  return result
}

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch {
      document.body.removeChild(textArea)
      return false
    }
  }
}