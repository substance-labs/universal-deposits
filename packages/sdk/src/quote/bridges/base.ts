import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { formatUnits } from 'viem'
import { QuoteRequest, QuoteResponse, BridgeConfig } from '../../types'

export abstract class BaseBridge {
  protected config: BridgeConfig
  protected axiosInstance: AxiosInstance

  constructor(config: BridgeConfig) {
    this.config = config
    this.axiosInstance = axios.create({
      timeout: this.config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  abstract getName(): string
  abstract getQuote(request: QuoteRequest): Promise<QuoteResponse>

  protected async makeRequest<T>(url: string, options: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance({
        url,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Include the error response data if available
        const errorData = error.response?.data
        const status = error.response?.status || 'unknown'

        if (errorData) {
          // If there's error data, include it in the error message
          throw new Error(
            `HTTP error! status: ${status}, response: ${JSON.stringify(errorData, null, 2)}`,
          )
        } else {
          throw new Error(`HTTP error! status: ${status}`)
        }
      }
      throw error
    }
  }
  protected formatAmount(amount: bigint, decimals: number = 18): string {
    // Helper to format amounts consistently
    return formatUnits(amount, decimals)
  }
}
