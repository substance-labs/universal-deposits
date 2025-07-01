import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { useTransactionStore } from '@/stores/transactions'
import { useOrderById } from '@/hooks/useAPI'
import type { Transaction } from '@/types/transaction'

// TODO: transaction is not updated correctly on History Page
// The current transaction id is set up the same way as the order Id stored in MongoDB
// in useEffect, the orderData?.status is changed, it should reflect on the History page
// however, this is not reflected correctly, it is stucked in Deposited

const TransactionCard: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  const { updateTransactionStatus } = useTransactionStore()
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  
  // Poll for order updates
  const { data: orderData } = useOrderById(transaction.id)

// Dev: the ACTUAL RETURN DATA IS orderData.data
  
  useEffect(() => {
    if (orderData && orderData?.data?.status) {
      updateTransactionStatus(transaction.id, orderData?.data?.status as Transaction['status'], JSON.stringify(orderData?.data))
    }
  }, [orderData?.data, orderData?.data?.status, updateTransactionStatus, transaction.id])
  
  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'Deposited':
        return 'bg-blue-100 text-blue-800'
      case 'Registered':
        return 'bg-yellow-100 text-yellow-800'
      case 'Deploying':
      case 'Settling':
      case 'Verifying':
        return 'bg-orange-100 text-orange-800'
      case 'Deployed':
      case 'Settled':
        return 'bg-purple-100 text-purple-800'
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'Failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }
  
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">
            Receiving {transaction.details.destinationTokenSymbol} on Gnosis Chain
          </CardTitle>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
            {transaction.status}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-600">Source Chain</p>
              <p>{transaction.details.sourceChainName}</p>
            </div>
            <div>
              <p className="font-medium text-gray-600">Transaction Hash</p>
              <p className="break-all text-xs">{transaction.txHash}</p>
            </div>
            <div>
              <p className="font-medium text-gray-600">Transfer Amount</p>
              <p>{transaction.amount} {transaction.details.sourceTokenSymbol}</p>
            </div>
            <div>
              <p className="font-medium text-gray-600">Recipient on Gnosis Chain</p>
              <p className="break-all">{transaction.destinationAddress}</p>
            </div>
            
          </div>
          
          <div className="mt-4">
            <button
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-700 text-sm">Status Details</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isDetailsOpen && (
              <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg">
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-600 text-sm">UD Order ID</p>
                    <p className="text-sm text-gray-900 font-mono">{transaction.id}</p>
                  </div>
                  
                  {transaction.statusMessage && (
                    <div>
                      <p className="font-medium text-gray-600 text-sm mb-2">Status Message</p>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                        {transaction.statusMessage}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="text-xs text-gray-500 mt-3">
            Created: {new Date(transaction.createdAt).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const History: React.FC = () => {
  const { transactions, clearTransactions } = useTransactionStore()
  
  const allTransactions = [...transactions]
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
        {allTransactions.length > 0 && (
          <button
            onClick={clearTransactions}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors"
          >
            Clear History
          </button>
        )}
      </div>
      
      {allTransactions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">No transactions yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Your transaction history will appear here after you make your first transfer
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allTransactions.map((transaction) => (
            <TransactionCard key={transaction.id} transaction={transaction} />
          ))}
        </div>
      )}
    </div>
  )
}