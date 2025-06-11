import { UniversalDeposits } from '@universal-deposits/sdk'
import { createPublicClient, http } from 'viem'
import { chains } from '@universal-deposits/constants'
import { ApiError } from '../middleware/errorHandler.js'
import { safeDeployedSchema } from '../schemas/validation.js'

export const checkSafeDeployed = async (req, res, next) => {
  try {
    const { sourceChainId, destinationChainToken, destinationChainAddress, destinationChainId } =
      req.query

    // Find the chain info
    const chain = chains.find((c) => c.chainId === Number(sourceChainId))
    if (!chain) {
      return next(
        ApiError.badRequest(`Unsupported source chain ID: ${sourceChainId}`, 'INVALID_CHAIN_ID'),
      )
    }

    // Create UD instance
    const ud = new UniversalDeposits({
      destinationAddress: destinationChainAddress,
      destinationToken: destinationChainToken,
      destinationChain: destinationChainId.toString(),
    })

    // Get contract addresses
    const udSafeParams = ud.getUDSafeParams()
    const safeModuleLogicParams = ud.getSafeModuleLogicParams()
    const safeModuleProxyParams = ud.getSafeModuleProxyParams()

    // Create client for checking code
    const client = createPublicClient({
      chain: {
        id: Number(sourceChainId),
      },
      transport: http(chain.rpcUrl),
    })

    // Check if contracts have code
    const [udSafeCode, safeModuleLogicCode, safeModuleProxyCode] = await Promise.all([
      client.getBytecode({ address: udSafeParams.contractAddress }).catch(() => null),
      client.getBytecode({ address: safeModuleLogicParams.contractAddress }).catch(() => null),
      client.getBytecode({ address: safeModuleProxyParams.contractAddress }).catch(() => null),
    ])

    // Return deployment status
    res.json({
      success: true,
      data: {
        isDeployed: !!(udSafeCode && safeModuleLogicCode && safeModuleProxyCode),
        contracts: {
          udSafe: {
            address: udSafeParams.contractAddress,
            hasCode: !!udSafeCode,
          },
          safeModuleLogic: {
            address: safeModuleLogicParams.contractAddress,
            hasCode: !!safeModuleLogicCode,
          },
          safeModuleProxy: {
            address: safeModuleProxyParams.contractAddress,
            hasCode: !!safeModuleProxyCode,
          },
        },
      },
    })
  } catch (error) {
    next(
      ApiError.badRequest(
        `Error checking Safe deployment: ${error.message}`,
        'SAFE_DEPLOYMENT_ERROR',
      ),
    )
  }
}

// Export schema for validation
export { safeDeployedSchema }
