import { getContract, keccak256 } from 'viem'
import { UniversalDeposits } from '@universal-deposits/sdk'
import { CreateXAbi, SafeProxyFactoryAbi, SafeLogicAbi } from './abi.js'
import { ADDRESSES } from '@universal-deposits/constants'
import { getServiceLogger } from './logger.js'

const logger = getServiceLogger('deployWorker')

class UniversalDepositsDeploymentService {
  constructor(config) {
    this.config = config
    this.publicClient = config.publicClient
    this.walletClient = config.walletClient
    this.settlementChainIds = new Map()
    this.settlementChainIds.set('100', '100000002')
    this.universalDepositInstance = new UniversalDeposits({
      destinationAddress: this.config.destinationAddress,
      destinationToken: this.config.destinationToken,
      destinationChain: this.config.destinationChain,
    })
  }

  // refer to https://github.com/safe-global/safe-smart-account/blob/main/contracts/proxies/SafeProxyFactory.sol
  async deployUniversalSafe() {
    const {
      saltNonce,
      initializer,
      contractAddress: expected,
    } = this.universalDepositInstance.getUDSafeParams()

    logger.info('Deploy universal deposit address at:', expected)

    // Check if already deployed
    const code = await this.publicClient.getCode({ address: expected })
    if (code && code !== '0x') {
      logger.info('UD safe already deployed @', expected)
      return expected
    }

    const safeProxyFactory = getContract({
      address: ADDRESSES.SAFE_PROXY_FACTORY,
      abi: SafeProxyFactoryAbi,
      client: this.walletClient,
    })

    // TODO: check if the source chain is L2, then call createProxyWithNonceL2 instead, and use SAFE_L2_SINGLETON
    const gas = await this.publicClient.estimateContractGas({
      address: ADDRESSES.SAFE_PROXY_FACTORY,
      abi: SafeProxyFactoryAbi,
      functionName: 'createProxyWithNonce',
      args: [ADDRESSES.SAFE_SINGLETON, initializer, saltNonce],
      account: await this.walletClient.account.address,
    })
    const hash = await safeProxyFactory.write.createProxyWithNonce(
      [ADDRESSES.SAFE_SINGLETON, initializer, saltNonce],
      { gas },
    )

    await this.publicClient.waitForTransactionReceipt({ hash })
    logger.info('Deploy UD Safe tx hash:', hash)

    // Verify module is enabled
    const moduleManager = getContract({
      address: expected,
      abi: SafeLogicAbi,
      client: this.publicClient,
    })

    const { contractAddress: safeModule } = this.universalDepositInstance.getSafeModuleProxyParams()
    const isEnabled = await moduleManager.read.isModuleEnabled([safeModule])

    if (!isEnabled) {
      throw new Error('Module not enabled on Safe')
    }

    logger.info('UD address @', expected)
    return expected
  }

  async deploySafeModuleLogic() {
    const {
      salt,
      bytecode: initCode,
      contractAddress: expectedSafeModuleLogicAddress,
    } = this.universalDepositInstance.getSafeModuleLogicParams()

    const code = await this.publicClient.getCode({ address: expectedSafeModuleLogicAddress })
    if (code && code !== '0x') {
      logger.info('SafeModule logic already deployed @', expectedSafeModuleLogicAddress)
      return expectedSafeModuleLogicAddress
    }

    const createxContract = getContract({
      address: ADDRESSES.CREATEX,
      abi: CreateXAbi,
      client: this.walletClient,
    })

    const expectedSafeByCreateX = await createxContract.read.computeCreate2Address({
      address: ADDRESSES.CREATEX,
      abi: CreateXAbi,
      client: this.publicClient,
      args: [keccak256(salt), keccak256(initCode)],
    })

    logger.info('Expected safe module logic address by Create2:', expectedSafeByCreateX)

    const gas = await this.publicClient.estimateContractGas({
      address: ADDRESSES.CREATEX,
      abi: CreateXAbi,
      functionName: 'deployCreate2',
      args: [salt, initCode],
      account: await this.walletClient.account.address,
    })

    const hash = await createxContract.write.deployCreate2([salt, initCode], { gas })
    await this.publicClient.waitForTransactionReceipt({ hash })
    logger.info('Deploy Safe Module logic tx hash:', hash)

    logger.info('Logic deployed @', expectedSafeModuleLogicAddress)
    return expectedSafeModuleLogicAddress
  }

  async deploySafeModuleProxy() {
    const {
      salt,
      bytecode: initCode,
      contractAddress: expectedSafeModuleProxyAddress,
    } = this.universalDepositInstance.getSafeModuleProxyParams()

    // Check if already deployed
    const code = await this.publicClient.getCode({ address: expectedSafeModuleProxyAddress })
    if (code && code !== '0x') {
      logger.info('SafeModule proxy already deployed @', expectedSafeModuleProxyAddress)
      return expectedSafeModuleProxyAddress
    }

    const createxContract = getContract({
      address: ADDRESSES.CREATEX,
      abi: CreateXAbi,
      client: this.walletClient,
    })

    const gas = await this.publicClient.estimateContractGas({
      address: ADDRESSES.CREATEX,
      abi: CreateXAbi,
      functionName: 'deployCreate2',
      args: [salt, initCode],
      account: await this.walletClient.account.address,
    })

    const hash = await createxContract.write.deployCreate2([salt, initCode], { gas })
    logger.info('Deploy SafeModuleProxy tx hash:', hash)
    await this.publicClient.waitForTransactionReceipt({ hash })

    logger.info('Proxy deployed @', expectedSafeModuleProxyAddress)
    return expectedSafeModuleProxyAddress
  }

  async run() {
    logger.debug('CreateX @', ADDRESSES.CREATEX)
    logger.debug('Deployer @', this.walletClient.account.address)
    logger.debug('Destination address @', this.config.destinationAddress)
    logger.debug('Destination chain @', this.config.destinationChain)
    logger.debug('Destination token @', this.config.destinationToken)

    let safeModuleLogic = '0x00'
    let safeModuleProxy = '0x00'
    let universalSafe = '0x00'
    if (process.env.MODE == 'dev') {
      logger.debug('mock: deploySafeModuleProxy function is called')
    } else {
      safeModuleLogic = await this.deploySafeModuleLogic()
      safeModuleProxy = await this.deploySafeModuleProxy()

      // TODO
      // Set settlement chain IDs
      // const safeModule = getContract({
      //   address: safeModuleProxy,
      //   abi: SafeModuleLogicAbi,
      //   client: this.walletClient,
      // })

      // const settlementChainId = this.settlementChainIds.get(this.config.destinationChain)

      // console.log('Settlement chainID ', settlementChainId)
      // if (settlementChainId) {
      //   // fail to call the function
      //   // TODO: fix the error, could be the mismatch function not found in bytecode
      //   const hash = await safeModule.write.setSettlementChainIds([
      //     this.config.destinationChain,
      //     settlementChainId,
      //   ])
      //   await this.publicClient.waitForTransactionReceipt({ hash })
      //   console.log('setSettlementChainIds tx hash ', hash)
      // }

      // Configure auto settlement if not already enabled
      // const autoSettlementEnabled = await safeModule.read.autoSettlement([originTokenAddress])
      // if (!autoSettlementEnabled || autoSettlementEnabled == '0x') {
      //   console.log('Call autoSettlement')
      //   const gasTx1 = await this.publicClient.estimateContractGas({
      //     address: safeModuleProxy,
      //     abi: SafeModuleLogicAbi,
      //     functionName: 'toggleAutoSettlement',
      //     args: [originTokenAddress],
      //     account: await this.walletClient.account.address,
      //   })
      //   const hash = await safeModule.write.toggleAutoSettlement([originTokenAddress], { gasTx1 })
      //   console.log('toggleAutoSettlement', hash)
      //   const gasTx2 = await this.publicClient.estimateContractGas({
      //     address: safeModuleProxy,
      //     abi: SafeModuleLogicAbi,
      //     functionName: 'setExchangeRate',
      //     args: [originTokenAddress, originTokenExchangeRate],
      //     account: await this.walletClient.account.address,
      //   })

      //   const setExRateHash = await safeModule.write.setExchangeRate(
      //     [originTokenAddress, originTokenExchangeRate],
      //     { gasTx2 },
      //   )
      //   console.log('SetExRatehash ', setExRateHash)
      // }

      // // Verify owner
      // const owner = await safeModule.read.owner()
      // if (owner !== this.walletClient.account.address) {
      //   throw new Error(`Owner mismatch: expected ${this.account.address}, got ${owner}`)
      // }

      // Deploy Universal Safe
      universalSafe = await this.deployUniversalSafe()

      // Set domain for CoW swaps
      // await safeModule.write.setDomain([universalSafe])
    }

    return {
      safeModuleLogic,
      safeModuleProxy,
      universalSafe,
    }
  }
}

async function deployContractOnOriginChain(
  publicClient,
  walletClient,
  destinationAddress,
  destinationToken,
  destinationChain,
  originTokenAddress,
  originTokenExchangeRate,
) {
  const config = {
    publicClient,
    walletClient,
    destinationAddress,
    destinationToken,
    destinationChain,
  }
  const service = new UniversalDepositsDeploymentService(config)

  try {
    const result = await service.run(originTokenExchangeRate, originTokenAddress)
    logger.info('Deployment completed:', result)
    return result
  } catch (error) {
    logger.error('Deployment failed:', error)
    throw error
  }
}

export { UniversalDepositsDeploymentService, deployContractOnOriginChain }
