import type { Order, Quote, UDSafeParams, ApiResponse } from '@/types'
import { API_BASE_URL } from '@/config/constants'

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
    console.log('🔧 ApiClient initialized with baseURL:', baseURL)
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`
    console.log('🌐 API request:', { url, options })
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...options.headers,
        },
        ...options,
      })

      console.log('📨 API response:', { status: response.status, statusText: response.statusText })

      if (!response.ok) {
        if (response.status === 404) {
          console.log('📨 API 404 - Not found')
          return { success: false, error: 'Not found' }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('📨 API response data:', data)
      return { success: true, data }
    } catch (error) {
      console.error('❌ API request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async registerAddress(params: {
    destinationAddress: string
    destinationToken: string
    destinationChain: string
  }): Promise<ApiResponse<void>> {
    return this.request('/register-address', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async getUDSafeAddress(params: UDSafeParams): Promise<ApiResponse<{data: {udSafeAddress: `0x${string}` } }>> {
    const searchParams = new URLSearchParams({
      destinationAddress: params.destinationAddress,
      destinationToken: params.destinationToken,
      destinationChain: params.destinationChain,
    })

    return this.request(`/ud-address?${searchParams}`)
  }

  async getOrderByRecipient(recipientAddress: string): Promise<ApiResponse< {data: Order} >> {
    return this.request(`/order/recipient/${recipientAddress}`)
  }

  async getOrderById(orderId: string): Promise<ApiResponse< {data: Order}>> {
    return this.request(`/order/orderId/${orderId}`)
  }

  async getQuote(params: {
    sourceChain: string
    sourceToken: string
    sourceAmount: string
    destinationChain: string
    destinationToken: string
  }): Promise<ApiResponse<Quote>> {
    const searchParams = new URLSearchParams(params)
    return this.request(`/quote?${searchParams}`)
  }

  async getOrderId(params: UDSafeParams): Promise<ApiResponse<{ orderIdHash: string }>> {
    const searchParams = new URLSearchParams({
      destinationAddress: params.destinationAddress,
      destinationToken: params.destinationToken,
      destinationChain: params.destinationChain,
    })

    return this.request(`/order-id?${searchParams}`)
  }

  async checkSafeDeployed(params: UDSafeParams): Promise<ApiResponse<{ deployed: boolean }>> {
    const searchParams = new URLSearchParams({
      destinationAddress: params.destinationAddress,
      destinationToken: params.destinationToken,
      destinationChain: params.destinationChain,
    })

    return this.request(`/safe-deployed?${searchParams}`)
  }

  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return this.request('/health')
  }
}

export const apiClient = new ApiClient(API_BASE_URL)