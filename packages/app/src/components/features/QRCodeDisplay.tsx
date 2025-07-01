import React, { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui'
import { copyToClipboard, formatAddress } from '@/utils'

interface QRCodeDisplayProps {
  address: string
  size?: number
  showCopyButton?: boolean
  className?: string
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  address,
  size = 200,
  showCopyButton = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (address && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, address, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
    }
  }, [address, size])

  const handleCopy = async () => {
    const success = await copyToClipboard(address)
    if (success) {
      // You can add a toast notification here
      console.log('Address copied to clipboard')
    }
  }

  if (!address) {
    return null
  }

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div className="p-4 bg-white rounded-xl shadow-soft border border-gray-200">
        <canvas ref={canvasRef} />
      </div>
      
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-gray-700">Deposit Address</p>
        <div className="flex items-center space-x-2">
          <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {formatAddress(address, 6)}
          </code>
          {showCopyButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              Copy
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}