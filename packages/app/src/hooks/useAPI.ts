import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import type { UDSafeParams } from '@/types'

export const useRegisterAddress = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: {
      destinationAddress: string
      destinationToken: string
      destinationChain: string
    }) => {
      console.log('🔄 useRegisterAddress mutationFn called with:', params)
      const result = await apiClient.registerAddress(params)
      console.log('📊 useRegisterAddress result:', result)
      return result
    },
    onSuccess: (data) => {
      console.log('✅ useRegisterAddress onSuccess:', data)
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error) => {
      console.error('❌ useRegisterAddress onError:', error)
    }
  })
}

export const useUDSafeAddress = (params: UDSafeParams | null) => {
  const enabled = !!params?.destinationAddress && !!params?.destinationToken && !!params?.destinationChain
  console.log('🔍 useUDSafeAddress hook:', { params, enabled })
  
  const result = useQuery({
    queryKey: ['udSafeAddress', params],
    queryFn: async () => {
      console.log('🔄 useUDSafeAddress queryFn called with:', params)
      if (!params) throw new Error('Parameters required')
      
      try {
        const response = await apiClient.getUDSafeAddress(params)
        console.log('📊 useUDSafeAddress raw response:', response)
        
        if (!response.success) {
          console.error('❌ useUDSafeAddress API error:', response.error)
          throw new Error(response.error)
        }
        
        console.log('✅ useUDSafeAddress success, returning data:', response.data)
        return response.data
      } catch (error) {
        console.error('❌ useUDSafeAddress queryFn error:', error)
        throw error
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
  
  console.log('🔍 useUDSafeAddress result:', {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    status: result.status,
    enabled
  })
  
  return result
}

export const useOrderByRecipient = (recipientAddress: string | null) => {
  const enabled = !!recipientAddress
  console.log('🔍 useOrderByRecipient hook:', { recipientAddress, enabled })
  
  return useQuery({
    queryKey: ['order', 'recipient', recipientAddress],
    queryFn: async () => {
      console.log('🔄 useOrderByRecipient queryFn called with:', recipientAddress)
      if (!recipientAddress) throw new Error('Recipient address required')
      
      const response = await apiClient.getOrderByRecipient(recipientAddress)
      console.log('📊 useOrderByRecipient response:', response)
      if (!response.success) {
        if (response.error === 'Not found') return null
        throw new Error(response.error)
      }
      return response.data
    },
    enabled,
    refetchInterval: (query) => {
      // Stop polling if order is completed or failed
      if (query.state.data?.data?.status === 'Completed' || query.state.data?.data?.status?.includes('Failed')) {
        return false
      }
      return 5000 // Poll every 5 seconds
    },
  })
}

export const useOrderById = (orderId: string | null) => {
  return useQuery({
    queryKey: ['order', 'id', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID required')
      const response = await apiClient.getOrderById(orderId)
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    enabled: !!orderId,
    refetchInterval: (query) => {
      // Stop polling if order is completed or failed
      if (query.state.data?.data?.status === 'Completed' || query.state.data?.data?.status?.includes('Failed')) {
        return false
      }
      return 5000 // Poll every 5 seconds
    },
  })
}

export const useQuote = () => {
  return useMutation({
    mutationFn: (params: {
      sourceChain: string
      sourceToken: string
      sourceAmount: string
      destinationChain: string
      destinationToken: string
    }) => apiClient.getQuote(params),
  })
}

export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await apiClient.healthCheck()
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
  })
}